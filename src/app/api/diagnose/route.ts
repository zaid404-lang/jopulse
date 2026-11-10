import { fetchReadings, summarise, SIM_TEMP, type Reading } from '@/lib/thingspeak';
import { describePfSurcharge, MOTOR_TEMP_WARN_C, MOTOR_TEMP_ALARM_C } from '@/lib/calculations';

// limits in the prompt come from the same constants the dashboard uses
const WARN = `${MOTOR_TEMP_WARN_C} °C`;
const ALARM = `${MOTOR_TEMP_ALARM_C} °C`;
const SIM_PLATEAU = `${SIM_TEMP.ambientC + SIM_TEMP.riseAtFullLoadC} °C`;

// AI diagnostics: a BluesMinds model reads the machine's recent ThingSpeak
// history and writes an early-warning assessment. BluesMinds speaks the
// OpenAI chat-completions format; the reply is streamed back as plain text.

const SYSTEM = `You are the predictive-maintenance analyst inside Plant Pulse, a dashboard for an industrial plant in Zarqa, Jordan.

You receive recent readings from one energy monitor (an ESP32 simulated in Wokwi, posting to ThingSpeak) on a single-phase load that behaves like a small motor or pump. Fields:
- voltage (V): supply voltage. Nominal 230 V; treat outside 207-253 V (±10%) as out of range.
- current (A): load current.
- power (W): active power.
- energy (kWh): counter since the device last started. A drop means the device restarted.
- status: 1 means running; anything else means stopped or faulted.
- pf: power factor, derived as power / (voltage x current). Under the EMRC medium-industry tariff a power factor below 0.90 adds a surcharge: ${describePfSurcharge()}.
- temperature (°C): motor temperature from a sensor on the machine. The plant warns at ${WARN} and alarms at ${ALARM}. Older readings were taken before the sensor was fitted and have it blank; if every reading is blank, say temperature isn't being reported yet.

Your job: say whether the machine looks healthy, point out anything drifting or abnormal, and warn about failures that the trends suggest, before they happen.

How to answer:
- Base every claim on the numbers given. Quote the actual values and times.
- When you extrapolate a trend, give the estimate as a range and say how confident you are. With only a few dozen readings over minutes, confidence is low; say so plainly instead of overstating.
- Rising current at steady voltage and power factor can mean growing mechanical load (bearing wear, clogging, misalignment). Falling power factor can mean motor winding or capacitor problems. Voltage sag or swell stresses insulation. Restarts and gaps can mean supply or controller faults. Use these as hypotheses, not diagnoses.
- Always assess temperature, and read it together with current: temperature rising with current suggests overload or bearing friction; temperature rising at steady current suggests a cooling problem (blocked fan or vents, high ambient). Heat ages motor insulation fast (roughly half the life for every 10 °C over its rating), so estimate when the temperature would reach ${WARN} and ${ALARM} if the trend continues, with a range and your confidence.
- If the data stopped arriving, say when and treat that as the first finding.
- Write for a plant manager, not an engineer: short sentences, no jargon without a plain explanation.

Format: plain text, no markdown tables, no bold, no code blocks. Use exactly these five section headings, each on its own line, in this order:
Status
What looks normal
What is drifting
Failure outlook
What to do
Under each heading write two to four short lines; start bullet lines with "- ". Keep the whole answer under 280 words.`;

function toCsv(readings: Reading[]): string {
  const rows = readings.map((r) =>
    [r.at, r.voltage ?? '', r.current ?? '', r.power ?? '', r.energy ?? '', r.status ?? '', r.pf ?? '', r.temperature ?? ''].join(',')
  );
  return ['time_utc,voltage_v,current_a,power_w,energy_kwh,status,pf,temperature_c', ...rows].join('\n');
}

// Some reasoning models put their scratch work inside <think>…</think> in the
// answer text; this drops it as it streams, even when a tag is split across chunks.
function makeThinkFilter() {
  let inThink = false;
  let carry = '';
  return (chunk: string): string => {
    let s = carry + chunk;
    carry = '';
    let out = '';
    while (s.length) {
      if (inThink) {
        const end = s.indexOf('</think>');
        if (end === -1) {
          carry = s.slice(-8); // keep a possible partial closing tag
          return out;
        }
        s = s.slice(end + 8);
        inThink = false;
      } else {
        const start = s.indexOf('<think>');
        if (start === -1) {
          const partial = s.lastIndexOf('<');
          if (partial !== -1 && '<think>'.startsWith(s.slice(partial))) {
            out += s.slice(0, partial);
            carry = s.slice(partial);
          } else {
            out += s;
          }
          return out;
        }
        out += s.slice(0, start);
        s = s.slice(start + 7);
        inThink = true;
      }
    }
    return out;
  };
}

export async function POST() {
  const apiKey = process.env.BLUESMINDS_API_KEY?.trim();
  const baseUrl = (process.env.BLUESMINDS_BASE_URL || 'https://api.bluesminds.com/v1').replace(/\/+$/, '');
  const model = process.env.BLUESMINDS_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';
  if (!apiKey) {
    return Response.json(
      { error: 'No BluesMinds API key found. Add BLUESMINDS_API_KEY to plant-pulse/.env.local.' },
      { status: 503 }
    );
  }

  let readings: Reading[];
  let temperatureSimulated = false;
  try {
    ({ readings, temperatureSimulated } = await fetchReadings(240));
  } catch (err) {
    return Response.json({ error: `Could not read ThingSpeak: ${err instanceof Error ? err.message : err}` }, { status: 502 });
  }
  if (!readings.length) {
    return Response.json({ error: 'The channel has no readings yet.' }, { status: 422 });
  }

  const summary = summarise(readings);
  const ageMin = summary.lastAt ? Math.round((Date.now() - Date.parse(summary.lastAt)) / 60000) : null;
  const userContent = `Current time (UTC): ${new Date().toISOString()}
Minutes since the last reading arrived: ${ageMin}
${
  temperatureSimulated
    ? `Temperature: no sensor reports yet, so temperature_c is SIMULATED from current: a heating curve from ${SIM_TEMP.ambientC} °C ambient that levels off at about ${SIM_PLATEAU} at full load (${SIM_TEMP.fullLoadA} A) and cannot go higher at that load, so do not extrapolate it in a straight line and do not predict it reaching ${WARN} or ${ALARM} unless the current rises well above ${SIM_TEMP.fullLoadA} A. Analyse it, but say clearly that it is an estimate, not a measurement.\n`
    : ''
}
Summary statistics (slopes are per hour, least squares):
${JSON.stringify(summary, null, 2)}

All readings, oldest first:
${toCsv(readings)}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userContent },
        ],
      }),
      cache: 'no-store',
    });
  } catch (err) {
    return Response.json({ error: `Could not reach BluesMinds: ${err instanceof Error ? err.message : err}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    let msg = `BluesMinds error ${upstream.status}`;
    if (upstream.status === 401 || upstream.status === 403) msg = 'BluesMinds rejected the API key. Check BLUESMINDS_API_KEY in plant-pulse/.env.local.';
    else if (upstream.status === 404 || upstream.status === 410) msg = `BluesMinds doesn't offer the model "${model}". Set BLUESMINDS_MODEL in .env.local to one your key lists.`;
    else if (upstream.status === 429) msg = 'BluesMinds is rate limiting right now. Try again in a minute.';
    else if (detail) msg += `: ${detail.slice(0, 200)}`;
    return Response.json({ error: msg }, { status: 502 });
  }

  // Re-stream: OpenAI-style server-sent events in, plain text out
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const filter = makeThinkFilter();
  const reader = upstream.body.getReader();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      let sentAny = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (!done) buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // keep a partial line for the next chunk, but at the end process whatever is left
          buffer = done ? '' : lines.pop() ?? '';
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              if (json.error) {
                controller.enqueue(encoder.encode(`\n[error] BluesMinds: ${json.error.message ?? 'request failed'}`));
                continue;
              }
              // only the answer text; any separate reasoning field is skipped
              const piece: string = json.choices?.[0]?.delta?.content ?? '';
              const text = filter(piece);
              if (text) {
                controller.enqueue(encoder.encode(text));
                sentAny = true;
              }
            } catch {
              /* a keep-alive or partial line; ignore */
            }
          }
          if (done) break;
        }
        if (!sentAny) controller.enqueue(encoder.encode('\n[error] The model returned no answer. Try again, or pick another BLUESMINDS_MODEL.'));
      } catch (err) {
        controller.enqueue(encoder.encode(`\n[error] The stream from BluesMinds broke off: ${err instanceof Error ? err.message : err}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Model': model },
  });
}
