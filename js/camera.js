'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — camera.js
 * Spring-smoothed follow camera. Keeps the player ~35% from the left edge,
 * with independent damping for the horizontal follow and the vertical
 * hill-compensation, so nothing ever snaps.
 * ==========================================================================*/
window.ER = window.ER || {};
ER.Camera = class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetY = 0;
        this.anchorFrac = 0.35;
        this._lastX = null;
    }
    update(dt, player, viewW) {
        const desiredX = player.worldX - viewW * this.anchorFrac;
        this.x = ER.Util.damp(this.x, desiredX, 4.2, dt);
        // Vertical compensation follows the road's elevation with its own spring
        // so hills feel weighty rather than instantly snapping the horizon.
        this.targetY = -player.groundY;
        this.y = ER.Util.damp(this.y, this.targetY, 3, dt);
    }
    get deltaX() {
        var _a;
        const d = this.x - ((_a = this._lastX) !== null && _a !== void 0 ? _a : this.x);
        this._lastX = this.x;
        return d;
    }
    worldToScreenX(worldX) { return worldX - this.x; }
};
//# sourceMappingURL=camera.js.map