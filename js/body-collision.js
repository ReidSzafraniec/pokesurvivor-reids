(function () {
  'use strict';

  const EPSILON = 1e-6;
  const installed = new WeakSet();
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clear = (enemy, players) => players.every(p =>
    distance(enemy, p) >= enemy.r + p.r - EPSILON);

  function touching(enemy, player) {
    return distance(enemy, player) <= enemy.r + player.r + EPSILON;
  }

  function sweep(enemy, previous, players) {
    const vx = enemy.x - previous.x, vy = enemy.y - previous.y;
    const length2 = vx * vx + vy * vy;
    if (length2 < EPSILON * EPSILON) return false;
    let first = 1;
    for (const p of players) {
      const x = previous.x - p.x, y = previous.y - p.y, radius = enemy.r + p.r;
      const outside = x * x + y * y - radius * radius;
      const toward = x * vx + y * vy;
      if (outside < -EPSILON || toward >= 0) continue;
      const discriminant = toward * toward - length2 * outside;
      if (discriminant <= 0) continue;
      const t = (-toward - Math.sqrt(discriminant)) / length2;
      if (t >= -EPSILON && t < first) first = Math.max(0, t);
    }
    if (first === 1) return false;
    enemy.x = previous.x + vx * first;
    enemy.y = previous.y + vy * first;
    return true;
  }

  function separate(enemy, players, world) {
    if (clear(enemy, players)) return;
    const origin = { x: enemy.x, y: enemy.y };
    for (let pass = 0; pass < 4; pass++) {
      for (const p of players) {
        const radius = enemy.r + p.r, d = distance(enemy, p);
        if (d >= radius) continue;
        const angle = d > EPSILON ? Math.atan2(enemy.y - p.y, enemy.x - p.x) :
          enemy.id * 2.399963229728653;
        enemy.x = p.x + Math.cos(angle) * radius;
        enemy.y = p.y + Math.sin(angle) * radius;
      }
      if (!enemy.flying) world.collide(enemy);
      if (clear(enemy, players)) return;
    }

    // A wall or another player can block the radial correction; try nearby contact points.
    const blocked = { x: enemy.x, y: enemy.y };
    const nearby = players.filter(p => touching(enemy, p));
    let best = null, bestDistance = Infinity;
    for (const p of nearby) {
      const angle = Math.atan2(origin.y - p.y, origin.x - p.x), radius = enemy.r + p.r;
      for (let step = 0; step < 32; step++) {
        const offset = Math.ceil(step / 2) * (step % 2 ? 1 : -1) * Math.PI / 16;
        enemy.x = p.x + Math.cos(angle + offset) * radius;
        enemy.y = p.y + Math.sin(angle + offset) * radius;
        if (!enemy.flying) world.collide(enemy);
        const moved = distance(enemy, origin);
        if (clear(enemy, players) && moved < bestDistance) {
          best = { x: enemy.x, y: enemy.y };
          bestDistance = moved;
        }
      }
    }
    // In fully blocked terrain, retain the terrain-safe position rather than enter a wall.
    Object.assign(enemy, best || blocked);
  }

  function install(game) {
    const manager = game.EnemyMgr;
    if (installed.has(manager)) return;
    installed.add(manager);
    let activePlayers = null;
    const update = manager.update, move = game.Enemy.prototype.update;
    game.Enemy.prototype.update = function (dt, target) {
      const previous = { x: this.x, y: this.y };
      const result = move.call(this, dt, target);
      const players = activePlayers || [target].filter(p => !p.dead && !p.silent);
      if (!this.dead && !this.arceus && sweep(this, previous, players) && !this.flying) {
        game.World.collide(this);
      }
      return result;
    };
    manager.update = function (dt, targets) {
      const players = (Array.isArray(targets) ? targets : [targets])
        .filter(p => !p.dead && !p.silent);
      const previousPlayers = activePlayers;
      activePlayers = players;
      let result;
      try {
        result = update.call(this, dt, targets);
      } finally {
        activePlayers = previousPlayers;
      }
      if (players.length) {
        for (const enemy of this.all()) {
          if (enemy.dead || enemy.arceus) continue;
          separate(enemy, players, game.World);
        }
      }
      return result;
    };
  }

  window.PSBodyCollision = { install, touching };
})();
