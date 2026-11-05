import { createServer } from 'node:http';

const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw),
      system = body.messages[0].content,
      data = JSON.parse(body.messages[1].content);
    let answer;
    if (system.startsWith('NARRAR'))
      answer = {
        narrative: data.baseConfirmada.split('\n\n')[0],
        question: data.final ? '' : '¿Qué decides hacer ahora?',
      };
    else {
      const t = data.intencion.toLowerCase();
      let plan;
      if (t.includes('descanso largo')) plan = { kind: 'rest', rest: 'long' };
      else if (t.includes('abandono')) plan = { kind: 'retreat' };
      else if (t.includes('huyo'))
        plan = { kind: 'escape', destination: 'road' };
      else if (t.includes('proyectil'))
        plan = {
          kind: 'cast',
          spellId: 'magicMissile',
          targetIds: ['bram'],
          options: { source: 'class' },
        };
      else if (t.includes('ataco'))
        plan = { kind: 'attack', targetId: 'bram', weaponId: 'quarterstaff' };
      else if (t.includes('camino'))
        plan = { kind: 'travel', destination: 'road' };
      else if (t.includes('molino'))
        plan = { kind: 'travel', destination: 'mill' };
      else if (t.includes('conven'))
        plan = { kind: 'interact', targetId: 'bram', method: 'persuade' };
      else if (t.includes('cámara'))
        plan = { kind: 'travel', destination: 'chamber' };
      else if (t.includes('palanca'))
        plan = { kind: 'interact', targetId: 'release-lever', method: 'use' };
      else if (t.includes('lente'))
        plan = { kind: 'interact', targetId: 'lens', method: 'take' };
      else if (t.includes('rescato'))
        plan = { kind: 'interact', targetId: 'sira', method: 'rescue' };
      else if (t.includes('faro'))
        plan = { kind: 'travel', destination: 'beacon' };
      else if (t.includes('manivela'))
        plan = {
          kind: 'interact',
          targetId: 'beacon-mechanism',
          method: 'use',
        };
      else
        plan = { kind: 'interact', targetId: 'village-map', method: 'inspect' };
      answer = { kind: 'action', plan };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: { content: JSON.stringify(answer) } }));
  } catch {
    res.writeHead(400);
    res.end();
  }
});
server.listen(11435, '127.0.0.1');
