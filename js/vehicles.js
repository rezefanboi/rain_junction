'use strict';
/* ============================================================================
 * ENDLESS RAIN — vehicles.js
 * Occasional cars that splash through puddles. Rare by design — this should
 * stay a quiet backdrop, not a hazard the player has to actively manage.
 * ==========================================================================*/
window.ER = window.ER || {};

ER.VehicleSystem = class VehicleSystem {
  constructor() {
    this.cars = [];
    this._timer = ER.Util.range(Math.random, 5, 10);
  }

  update(dt, minX, maxX, puddles, onSplash) {
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = ER.Util.range(Math.random, 9, 19);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = (70 + Math.random() * 55) * dir;
      const startX = dir > 0 ? minX - 260 : maxX + 260;
      this.cars.push({
        worldX: startX, speed, dir, wheelSpin: 0,
        lane: dir > 0 ? -18 : 18,
        splashed: new Set(),
        hue: 0.7 + Math.random() * 0.3,
      });
    }

    for (const car of this.cars) {
      car.worldX += car.speed * dt;
      car.wheelSpin += Math.abs(car.speed) * dt * 0.05;
      for (const p of puddles) {
        const key = p.worldX.toFixed(1);
        const carFront = car.worldX + (car.dir > 0 ? 26 : -26);
        if (!car.splashed.has(key) && Math.abs(carFront - p.worldX) < p.width * 0.5) {
          car.splashed.add(key);
          onSplash(p.worldX, car.dir);
        }
      }
    }
    this.cars = this.cars.filter((c) => c.worldX > minX - 400 && c.worldX < maxX + 400);
  }
};
