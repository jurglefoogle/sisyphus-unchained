import { Application, Container, Graphics } from 'pixi.js';
import { FigureRig } from './rig';
import { walkCycle, standPose, pushPose, fallenPose, easePose } from './figure';

const app = new Application();
await app.init({ width: 1100, height: 560, background: '#d99c6c', antialias: true, resolution: devicePixelRatio, autoDensity: true });
document.body.append(app.canvas);
const stage = new Container();
stage.position.set(550, 465);
stage.scale.set(2.5);
app.stage.addChild(stage);
const ground = new Graphics();
const rig = new FigureRig();
stage.addChild(ground, rig);
const action = document.querySelector<HTMLSelectElement>('#action')!;
const slope = document.querySelector<HTMLSelectElement>('#slope')!;
const scrub = document.querySelector<HTMLInputElement>('#phase')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
let playing = true, phase = 0, time = 0, facing = 1;
const pose = standPose();
play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; };
document.querySelector<HTMLButtonElement>('#face')!.onclick = () => { facing *= -1; };
scrub.oninput = () => { phase = Number(scrub.value); playing = false; play.textContent = 'Play'; };
app.ticker.add(ticker => {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  if (playing) { time += dt; phase += dt * 1.4; scrub.value = String(phase % 1); }
  const grade = Number(slope.value);
  const want = action.value === 'walk' ? walkCycle(phase, 26, 0.25, x => x * grade)
    : action.value === 'push' ? pushPose(time) : action.value === 'fall' ? fallenPose(time) : standPose(time * 1.7);
  want.ground = Math.atan(grade);
  want.sway = action.value === 'walk' ? Math.sin(phase * Math.PI * 4) * 1.2 : 0;
  easePose(pose, want, playing ? 1 - Math.exp(-dt * 30) : 1);
  rig.scale.x = facing;
  rig.update(pose, true, time, facing < 0);
  ground.clear().moveTo(-230, -230 * grade * facing + 1).lineTo(230, 230 * grade * facing + 1).stroke({ width: 1.5, color: 0x63432e });
  const offset = action.value === 'walk' ? (phase * (52 / 0.6)) % 24 : 0;
  for (let x = -260; x < 260; x += 24) {
    const dx = (x - offset) * facing;
    ground.moveTo(dx, dx * grade * facing + 2).lineTo(dx - 4, dx * grade * facing + 6).stroke({ width: 1, color: 0x63432e, alpha: 0.4 });
  }
});
