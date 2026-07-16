'use strict';
/* ============================================================================
 * AS THE DROPLETS FALL — umbrella.js
 * The only player-controlled mechanic. Two fixes over the original build:
 *
 * 1) shields() previously only tested the shaft area between the pivot and
 *    the canopy's attachment point (ry between -canopyLength and 0). The
 *    actual fabric — the dome — is drawn ABOVE that point, spanning from
 *    -canopyLength up to -(canopyLength + canopyHalfWidth). Any raindrop
 *    reaching the visible dome was falling outside the old test box, so the
 *    player got wet while looking perfectly covered. The dome is now tested
 *    as its own region (a circle at the canopy tip, matching the drawn
 *    silhouette exactly), with a small forgiveness margin for near-rim hits.
 *
 * 2) Rotation now eases toward a target angular velocity (via damp) instead
 *    of raw Euler-integrated acceleration, so tilting feels smoother and
 *    more predictable — no overshoot twitchiness when reversing direction.
 * ==========================================================================*/
window.ER = window.ER || {};
ER.Umbrella = class Umbrella {
    constructor() {
        this.angle = 0; // degrees from vertical, matches wind convention
        this.angularVel = 0;
        this.maxAngle = 62;      // absolute hard cap (degrees)
        this.maxAngleRight = 62; // dynamic per-side limit — updated each frame via setScreenBounds()
        this.maxAngleLeft  = 62;
        this.maxSpeed = 150; // deg/s
        this.turnRate = 11; // how quickly angularVel eases toward target (damp lambda)
        this.friction = 4.6; // damping when released
        this.canopyLength = 58;
        this.canopyHalfWidth = 21;
    }
    /**
     * Called each frame with the umbrella pivot's screen X and the canvas width.
     * Computes the maximum tilt angle (degrees) allowed on each side so the
     * canopy tip never travels beyond the visible screen edge.
     *
     * Geometry: the tip is offset horizontally by sin(angle) * canopyLength from
     * the pivot, so the limit angle for a given clearance `d` is:
     *   asin(clamp(d / canopyLength, 0, 1))  — converted to degrees.
     *
     * pivotX  = player screen X (umbrella is drawn at player origin translate(0,-50))
     * screenW = canvas logical width
     */
    setScreenBounds(pivotX, screenW) {
        const edgeMargin = 12; // px cushion so the rim never kisses the edge
        const rightRoom = Math.max(0, screenW - pivotX - edgeMargin);
        const leftRoom  = Math.max(0, pivotX  - edgeMargin);
        const toDeg = r => r * (180 / Math.PI);
        this.maxAngleRight = Math.min(this.maxAngle, toDeg(Math.asin(Math.min(1, rightRoom / this.canopyLength))));
        this.maxAngleLeft  = Math.min(this.maxAngle, toDeg(Math.asin(Math.min(1, leftRoom  / this.canopyLength))));
    }
    update(dt, axis) {
        if (axis !== 0) {
            const target = axis * this.maxSpeed;
            this.angularVel = ER.Util.damp(this.angularVel, target, this.turnRate, dt);
        }
        else {
            this.angularVel *= Math.max(0, 1 - this.friction * dt);
        }
        this.angle += this.angularVel * dt;
        // Use the per-side dynamic limits so the canopy can't fly off-screen.
        if (this.angle > this.maxAngleRight) {
            this.angle = this.maxAngleRight;
            this.angularVel = 0;
        }
        if (this.angle < -this.maxAngleLeft) {
            this.angle = -this.maxAngleLeft;
            this.angularVel = 0;
        }
    }
    /**
     * Point-in-canopy test. `dx,dy` = point relative to umbrella pivot (screen
     * px, +y down). Returns true if the point is shielded by the canopy.
     */
    shields(dx, dy) {
        const rad = ER.Util.deg2rad(this.angle);
        const cos = Math.cos(rad), sin = Math.sin(rad);
        // Rotate the point into umbrella-local space (canopy points "up" from the
        // pivot, tilted by `angle` the same way wind angle is measured).
        const rx = dx * cos + dy * sin;
        const ry = -dx * sin + dy * cos;
        const hw = this.canopyHalfWidth;
        const domeY = -this.canopyLength; // where the dome attaches to the pole
        const forgiveness = 5; // small, generous margin — no pixel-perfect frustration
        // Shaft region: the open space directly under the canopy, down to the pivot.
        if (ry < 0 && ry >= domeY && rx > -hw && rx < hw)
            return true;
        // Dome region: the actual fabric, matching the half-circle drawn in
        // Renderer.drawPlayer exactly (center at (0, domeY), radius hw).
        if (ry <= domeY + forgiveness) {
            const ddx = rx;
            const ddy = ry - domeY;
            const r = hw + forgiveness;
            if (ddx * ddx + ddy * ddy <= r * r)
                return true;
        }
        return false;
    }
};
//# sourceMappingURL=umbrella.js.map