export function POST() {
  return Response.json(
    {
      error:
        'Esta ruta pertenece a la versión anterior. Actualiza la aplicación y continúa desde tu partida.',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
