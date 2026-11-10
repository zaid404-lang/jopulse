import { fetchReadings, summarise, ThingSpeakConfigError } from '@/lib/thingspeak';

// Live sensor data for the dashboard. The read key stays on the server.
export async function GET(request: Request) {
  const results = Number(new URL(request.url).searchParams.get('results') ?? 240) || 240;
  try {
    const { channel, readings, temperatureSimulated } = await fetchReadings(results);
    return Response.json({ channel, readings, temperatureSimulated, summary: summarise(readings), fetchedAt: new Date().toISOString() });
  } catch (err) {
    const status = err instanceof ThingSpeakConfigError ? 500 : 502;
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status });
  }
}
