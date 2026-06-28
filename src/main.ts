import "./styles.css";

const SAVE_KEY = "task-bar-hero-anime-save-v2";
const HERO_SPAWN_X = 88;
const MONSTER_SPAWN_X = 12;
const MELEE_RANGE = 7;
const MAX_MONSTERS = 4;
const MONSTER_SPAWN_SECONDS = 2.6;
const LANES = [62, 73, 84];

type Team = "hero" | "monster";
type UnitKind = "hero" | "ranger" | "monster" | "boss";
type UpgradeKind = "sword" | "click";

interface SavedState {
  gold: number;
  kills: number;
  monsterLevel: number;
  swordLevel: number;
  clickUpgradeLevel: number;
  heroLevel: number;
  heroXp: number;
}

interface Unit {
  id: number;
  team: Team;
  kind: UnitKind;
  name: string;
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  attackTimer: number;
  attackFlash: number;
  reward: number;
  xpReward: number;
  level: number;
  respawnTimer?: number;
}

interface FloatingText {
  id: number;
  x: number;
  lane: number;
  text: string;
  ttl: number;
}

const defaultState: SavedState = {
  gold: 0,
  kills: 0,
  monsterLevel: 1,
  swordLevel: 0,
  clickUpgradeLevel: 0,
  heroLevel: 1,
  heroXp: 0,
};

let state = loadState();
let unitId = 1;
let textId = 1;
let monsterSpawnTimer = 0;
let lastFrame = performance.now();
const units: Unit[] = [];
const floatingTexts: FloatingText[] = [];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

app.innerHTML = `
  <main class="app" aria-label="Task Bar Hero Anime prototype">
    <section class="topbar" aria-label="Game status">
      <div class="title-block">
        <h1>Task Bar Hero Anime</h1>
        <p>Heroes move from right to left. Monsters push from left to right.</p>
      </div>
      <dl class="stats">
        <div><dt>Gold</dt><dd id="goldValue">0</dd></div>
        <div><dt>Kills</dt><dd id="killsValue">0</dd></div>
        <div><dt>Hero lvl</dt><dd id="heroLevelValue">1</dd></div>
        <div><dt>DPS</dt><dd id="dpsValue">0</dd></div>
        <div><dt>Click</dt><dd id="clickDamageValue">0</dd></div>
        <div><dt>Wave</dt><dd id="waveValue">1</dd></div>
      </dl>
    </section>

    <section id="battlefield" class="battlefield" aria-label="Pixel battle scene"></section>

    <section class="shop" aria-label="Upgrade shop">
      <button id="buySwordButton" class="shop-item" type="button">
        <span>
          <strong>Sword Training</strong>
          <small id="swordLevelText">Level 0</small>
        </span>
        <span id="swordCostText">10 gold</span>
      </button>
      <button id="buyClickButton" class="shop-item" type="button">
        <span>
          <strong>Focused Strike</strong>
          <small id="clickLevelText">Level 0</small>
        </span>
        <span id="clickCostText">8 gold</span>
      </button>
      <button id="resetButton" class="reset-button" type="button">Reset</button>
    </section>
  </main>
`;

const elements = {
  battlefield: query<HTMLDivElement>("#battlefield"),
  goldValue: query<HTMLElement>("#goldValue"),
  killsValue: query<HTMLElement>("#killsValue"),
  heroLevelValue: query<HTMLElement>("#heroLevelValue"),
  dpsValue: query<HTMLElement>("#dpsValue"),
  clickDamageValue: query<HTMLElement>("#clickDamageValue"),
  waveValue: query<HTMLElement>("#waveValue"),
  buySwordButton: query<HTMLButtonElement>("#buySwordButton"),
  buyClickButton: query<HTMLButtonElement>("#buyClickButton"),
  resetButton: query<HTMLButtonElement>("#resetButton"),
  swordLevelText: query<HTMLElement>("#swordLevelText"),
  clickLevelText: query<HTMLElement>("#clickLevelText"),
  swordCostText: query<HTMLElement>("#swordCostText"),
  clickCostText: query<HTMLElement>("#clickCostText"),
};

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function loadState(): SavedState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) {
      return { ...defaultState };
    }

    const parsed = JSON.parse(saved) as Partial<SavedState>;
    return { ...defaultState, ...parsed };
  } catch {
    return { ...defaultState };
  }
}

function saveState(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function monsterMaxHp(level: number): number {
  return Math.ceil(12 * Math.pow(1.18, level - 1));
}

function monsterReward(level: number): number {
  return Math.ceil(5 * Math.pow(1.12, level - 1));
}

function heroDps(): number {
  return round(2 + state.heroLevel * 0.45 + state.swordLevel * 0.85);
}

function clickDamage(): number {
  return Math.floor(1 + state.heroLevel * 0.25 + state.clickUpgradeLevel);
}

function swordCost(): number {
  return Math.ceil(10 * Math.pow(1.25, state.swordLevel));
}

function clickCost(): number {
  return Math.ceil(8 * Math.pow(1.25, state.clickUpgradeLevel));
}

function xpToNextLevel(): number {
  return Math.ceil(8 * Math.pow(1.28, state.heroLevel - 1));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function format(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function createHero(kind: UnitKind, name: string, laneIndex: number): Unit {
  const baseDamage = heroDps() * (kind === "ranger" ? 0.82 : 1);

  return {
    id: unitId++,
    team: "hero",
    kind,
    name,
    x: HERO_SPAWN_X + laneIndex * 4,
    lane: LANES[laneIndex] ?? LANES[0],
    hp: 24 + state.heroLevel * 6,
    maxHp: 24 + state.heroLevel * 6,
    speed: kind === "ranger" ? 6.2 : 4.8,
    damage: round(baseDamage),
    attackCooldown: kind === "ranger" ? 0.9 : 1.15,
    attackTimer: 0,
    attackFlash: 0,
    reward: 0,
    xpReward: 0,
    level: state.heroLevel,
  };
}

function createMonster(): Unit {
  const level = state.monsterLevel;
  const isBoss = level % 10 === 0;
  const lane = LANES[Math.floor(Math.random() * LANES.length)] ?? LANES[0];
  const maxHp = monsterMaxHp(level) * (isBoss ? 4 : 1);

  return {
    id: unitId++,
    team: "monster",
    kind: isBoss ? "boss" : "monster",
    name: isBoss ? "Taskbar Boss" : monsterName(level),
    x: MONSTER_SPAWN_X - Math.random() * 8,
    lane,
    hp: maxHp,
    maxHp,
    speed: isBoss ? 3.1 : 4 + Math.min(2.5, level * 0.05),
    damage: round((1.2 + level * 0.18) * (isBoss ? 1.8 : 1)),
    attackCooldown: isBoss ? 1.35 : 1.6,
    attackTimer: Math.random() * 0.5,
    attackFlash: 0,
    reward: monsterReward(level) * (isBoss ? 6 : 1),
    xpReward: Math.ceil(3 + level * (isBoss ? 1.4 : 0.45)),
    level,
  };
}

function monsterName(level: number): string {
  const names = ["Bone Walker", "Cache Wisp", "Popup Imp", "Lag Phantom", "Bug Sprite"];
  return names[(level - 1) % names.length] ?? "Bone Walker";
}

function spawnInitialUnits(): void {
  units.push(createHero("hero", "Aiko", 1));
  units.push(createHero("ranger", "Mina", 2));
  units.push(createMonster());
}

function update(deltaSeconds: number): void {
  monsterSpawnTimer -= deltaSeconds;

  if (monsterSpawnTimer <= 0 && aliveMonsters().length < MAX_MONSTERS) {
    units.push(createMonster());
    monsterSpawnTimer = MONSTER_SPAWN_SECONDS;
  }

  for (const unit of units) {
    if (unit.hp <= 0) {
      updateDeadUnit(unit, deltaSeconds);
      continue;
    }

    unit.attackTimer = Math.max(0, unit.attackTimer - deltaSeconds);
    unit.attackFlash = Math.max(0, unit.attackFlash - deltaSeconds);

    const target = findTarget(unit);
    if (target && distance(unit, target) <= MELEE_RANGE) {
      attack(unit, target);
    } else {
      unit.x += unit.team === "hero" ? -unit.speed * deltaSeconds : unit.speed * deltaSeconds;
      unit.x = clamp(unit.x, 5, 95);
    }
  }

  for (const text of floatingTexts) {
    text.ttl -= deltaSeconds;
  }

  removeDefeatedMonsters();
  removeExpiredText();
}

function updateDeadUnit(unit: Unit, deltaSeconds: number): void {
  if (unit.team !== "hero") {
    return;
  }

  unit.respawnTimer = (unit.respawnTimer ?? 3.2) - deltaSeconds;
  if (unit.respawnTimer <= 0) {
    unit.hp = unit.maxHp;
    unit.x = HERO_SPAWN_X;
    unit.respawnTimer = undefined;
  }
}

function attack(attacker: Unit, target: Unit): void {
  if (attacker.attackTimer > 0 || target.hp <= 0) {
    return;
  }

  attacker.attackTimer = attacker.attackCooldown;
  attacker.attackFlash = 0.18;
  applyDamage(target, attacker.damage, attacker.x, attacker.lane);
}

function applyDamage(target: Unit, damage: number, sourceX: number, sourceLane: number): void {
  target.hp = round(Math.max(0, target.hp - damage));
  floatingTexts.push({
    id: textId++,
    x: (target.x + sourceX) / 2,
    lane: sourceLane - 6,
    text: `-${format(damage)}`,
    ttl: 0.72,
  });

  if (target.hp <= 0 && target.team === "monster") {
    defeatMonster(target);
  }
}

function defeatMonster(monster: Unit): void {
  state.gold += monster.reward;
  state.kills += 1;
  state.heroXp += monster.xpReward;
  state.monsterLevel += 1;

  while (state.heroXp >= xpToNextLevel()) {
    state.heroXp -= xpToNextLevel();
    state.heroLevel += 1;
    refreshHeroStats();
  }

  saveState();
}

function refreshHeroStats(): void {
  for (const hero of units.filter((unit) => unit.team === "hero")) {
    const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
    hero.maxHp = 24 + state.heroLevel * 6;
    hero.hp = Math.ceil(hero.maxHp * hpRatio);
    hero.damage = round(heroDps() * (hero.kind === "ranger" ? 0.82 : 1));
    hero.level = state.heroLevel;
  }
}

function buyUpgrade(kind: UpgradeKind): void {
  const cost = kind === "sword" ? swordCost() : clickCost();
  if (state.gold < cost) {
    return;
  }

  state.gold -= cost;

  if (kind === "sword") {
    state.swordLevel += 1;
  } else {
    state.clickUpgradeLevel += 1;
  }

  refreshHeroStats();
  saveState();
}

function resetSave(): void {
  localStorage.removeItem(SAVE_KEY);
  state = { ...defaultState };
  units.splice(0, units.length);
  floatingTexts.splice(0, floatingTexts.length);
  unitId = 1;
  textId = 1;
  monsterSpawnTimer = 0;
  spawnInitialUnits();
  saveState();
}

function aliveMonsters(): Unit[] {
  return units.filter((unit) => unit.team === "monster" && unit.hp > 0);
}

function findTarget(unit: Unit): Unit | undefined {
  const enemies = units.filter((candidate) => candidate.team !== unit.team && candidate.hp > 0);
  enemies.sort((a, b) => distance(unit, a) - distance(unit, b));
  return enemies[0];
}

function distance(a: Unit, b: Unit): number {
  return Math.abs(a.x - b.x) + Math.abs(a.lane - b.lane) * 0.35;
}

function removeDefeatedMonsters(): void {
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (unit?.team === "monster" && unit.hp <= 0) {
      units.splice(index, 1);
    }
  }
}

function removeExpiredText(): void {
  for (let index = floatingTexts.length - 1; index >= 0; index -= 1) {
    if ((floatingTexts[index]?.ttl ?? 0) <= 0) {
      floatingTexts.splice(index, 1);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function render(): void {
  renderStats();
  renderBattlefield();
}

function renderStats(): void {
  const swordPrice = swordCost();
  const clickPrice = clickCost();

  elements.goldValue.textContent = format(state.gold);
  elements.killsValue.textContent = format(state.kills);
  elements.heroLevelValue.textContent = `${state.heroLevel} (${state.heroXp}/${xpToNextLevel()} XP)`;
  elements.dpsValue.textContent = format(heroDps());
  elements.clickDamageValue.textContent = format(clickDamage());
  elements.waveValue.textContent = format(state.monsterLevel);
  elements.swordLevelText.textContent = `Level ${state.swordLevel}`;
  elements.clickLevelText.textContent = `Level ${state.clickUpgradeLevel}`;
  elements.swordCostText.textContent = `${format(swordPrice)} gold`;
  elements.clickCostText.textContent = `${format(clickPrice)} gold`;
  elements.buySwordButton.disabled = state.gold < swordPrice;
  elements.buyClickButton.disabled = state.gold < clickPrice;
}

function renderBattlefield(): void {
  const laneLines = LANES.map((lane) => `<span class="lane-line" style="top: ${lane}%"></span>`).join("");
  const unitMarkup = [...units]
    .sort((a, b) => a.lane - b.lane)
    .map(renderUnit)
    .join("");
  const textMarkup = floatingTexts.map(renderFloatingText).join("");

  elements.battlefield.innerHTML = laneLines + unitMarkup + textMarkup;
}

function renderUnit(unit: Unit): string {
  const hpPercent = `${clamp((unit.hp / unit.maxHp) * 100, 0, 100)}%`;
  const facing = unit.team === "hero" ? -1 : 1;
  const attackingClass = unit.attackFlash > 0 ? " is-attacking" : "";
  const hiddenClass = unit.hp <= 0 ? " is-dead" : "";

  return `
    <button
      class="unit is-${unit.team}${attackingClass}${hiddenClass}"
      type="button"
      data-unit-id="${unit.id}"
      style="left: ${unit.x}%; top: ${unit.lane}%"
      aria-label="${unit.name}, level ${unit.level}, ${format(unit.hp)} HP"
    >
      <span class="nameplate">${unit.name}</span>
      <span class="hp-chip" style="--hp: ${hpPercent}"><span></span></span>
      <span class="sprite ${unit.kind}" style="--facing: ${facing}"></span>
    </button>
  `;
}

function renderFloatingText(text: FloatingText): string {
  return `
    <span
      class="floating-text"
      style="--x: ${text.x}%; --y: ${text.lane}%"
    >${text.text}</span>
  `;
}

function handleBattlefieldClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>(".unit.is-monster");
  if (!target) {
    return;
  }

  const unitIdAttribute = target.dataset.unitId;
  const monster = units.find((unit) => unit.id === Number(unitIdAttribute));
  if (!monster || monster.hp <= 0) {
    return;
  }

  applyDamage(monster, clickDamage(), monster.x, monster.lane);
  saveState();
  render();
}

function gameLoop(now: number): void {
  const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  update(deltaSeconds);
  render();
  requestAnimationFrame(gameLoop);
}

elements.battlefield.addEventListener("click", handleBattlefieldClick);
elements.buySwordButton.addEventListener("click", () => buyUpgrade("sword"));
elements.buyClickButton.addEventListener("click", () => buyUpgrade("click"));
elements.resetButton.addEventListener("click", resetSave);

spawnInitialUnits();
saveState();
render();
requestAnimationFrame(gameLoop);
