const SAVE_KEY = "task-bar-hero-anime-save-v1";
const TICK_MS = 1000;

const defaultState = {
  gold: 0,
  monsterLevel: 1,
  monsterHp: null,
  kills: 0,
  swordLevel: 0,
  clickUpgradeLevel: 0,
  totalDamage: 0,
};

let state = loadState();
let currentMaxHp = monsterMaxHp(state.monsterLevel);

if (state.monsterHp === null || state.monsterHp <= 0 || state.monsterHp > currentMaxHp) {
  state.monsterHp = currentMaxHp;
}

const elements = {
  goldValue: document.querySelector("#goldValue"),
  dpsValue: document.querySelector("#dpsValue"),
  clickDamageValue: document.querySelector("#clickDamageValue"),
  killsValue: document.querySelector("#killsValue"),
  monsterName: document.querySelector("#monsterName"),
  monsterLevel: document.querySelector("#monsterLevel"),
  monsterHpText: document.querySelector("#monsterHpText"),
  monsterHpBar: document.querySelector("#monsterHpBar"),
  monsterButton: document.querySelector("#monsterButton"),
  buySwordButton: document.querySelector("#buySwordButton"),
  buyClickButton: document.querySelector("#buyClickButton"),
  swordLevelText: document.querySelector("#swordLevelText"),
  clickLevelText: document.querySelector("#clickLevelText"),
  swordCostText: document.querySelector("#swordCostText"),
  clickCostText: document.querySelector("#clickCostText"),
  resetButton: document.querySelector("#resetButton"),
};

function monsterMaxHp(level) {
  return Math.ceil(10 * Math.pow(1.18, level - 1));
}

function monsterReward(level) {
  return Math.ceil(5 * Math.pow(1.12, level - 1));
}

function heroDps() {
  return round(1 + state.swordLevel * 0.75);
}

function clickDamage() {
  return Math.floor(1 + state.clickUpgradeLevel);
}

function swordCost() {
  return Math.ceil(10 * Math.pow(1.25, state.swordLevel));
}

function clickCost() {
  return Math.ceil(8 * Math.pow(1.25, state.clickUpgradeLevel));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function format(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function loadState() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) {
      return { ...defaultState };
    }

    return { ...defaultState, ...JSON.parse(saved) };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function dealDamage(amount, source = "auto", event) {
  const damage = round(amount);
  state.monsterHp = round(Math.max(0, state.monsterHp - damage));
  state.totalDamage = round(state.totalDamage + damage);

  showHitText(damage, source, event);

  if (state.monsterHp <= 0) {
    defeatMonster();
  }

  saveState();
  render();
}

function defeatMonster() {
  state.gold += monsterReward(state.monsterLevel);
  state.kills += 1;
  state.monsterLevel += 1;
  currentMaxHp = monsterMaxHp(state.monsterLevel);
  state.monsterHp = currentMaxHp;
}

function buyUpgrade(kind) {
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

  saveState();
  render();
}

function resetSave() {
  localStorage.removeItem(SAVE_KEY);
  state = { ...defaultState };
  currentMaxHp = monsterMaxHp(state.monsterLevel);
  state.monsterHp = currentMaxHp;
  render();
}

function monsterName(level) {
  if (level % 10 === 0) {
    return "Taskbar Boss";
  }

  const names = ["Training Slime", "Cache Wisp", "Popup Imp", "Lag Phantom", "Bug Sprite"];
  return names[(level - 1) % names.length];
}

function showHitText(damage, source, event) {
  const text = document.createElement("span");
  text.className = "hit-text";
  text.textContent = source === "click" ? `-${format(damage)} click` : `-${format(damage)}`;

  const rect = elements.monsterButton.getBoundingClientRect();
  const x = event ? event.clientX - rect.left : rect.width / 2;
  const y = event ? event.clientY - rect.top : rect.height / 2;

  text.style.setProperty("--x", `${x}px`);
  text.style.setProperty("--y", `${y}px`);

  elements.monsterButton.append(text);
  window.setTimeout(() => text.remove(), 720);
}

function render() {
  currentMaxHp = monsterMaxHp(state.monsterLevel);
  const hpPercent = Math.max(0, Math.min(100, (state.monsterHp / currentMaxHp) * 100));
  const swordPrice = swordCost();
  const clickPrice = clickCost();

  elements.goldValue.textContent = format(state.gold);
  elements.dpsValue.textContent = format(heroDps());
  elements.clickDamageValue.textContent = format(clickDamage());
  elements.killsValue.textContent = format(state.kills);
  elements.monsterName.textContent = monsterName(state.monsterLevel);
  elements.monsterLevel.textContent = `Level ${state.monsterLevel}`;
  elements.monsterHpText.textContent = `${format(state.monsterHp)} / ${format(currentMaxHp)}`;
  elements.monsterHpBar.style.width = `${hpPercent}%`;

  elements.swordLevelText.textContent = `Level ${state.swordLevel}`;
  elements.clickLevelText.textContent = `Level ${state.clickUpgradeLevel}`;
  elements.swordCostText.textContent = `${format(swordPrice)} gold`;
  elements.clickCostText.textContent = `${format(clickPrice)} gold`;

  elements.buySwordButton.disabled = state.gold < swordPrice;
  elements.buyClickButton.disabled = state.gold < clickPrice;
}

elements.monsterButton.addEventListener("click", (event) => {
  dealDamage(clickDamage(), "click", event);
});

elements.buySwordButton.addEventListener("click", () => buyUpgrade("sword"));
elements.buyClickButton.addEventListener("click", () => buyUpgrade("click"));
elements.resetButton.addEventListener("click", resetSave);

window.setInterval(() => {
  dealDamage(heroDps(), "auto");
}, TICK_MS);

render();
saveState();
