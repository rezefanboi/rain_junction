extends Node2D

const CHUNK_WIDTH := 900.0

const SKY_TOP := Color("#3d4759")
const SKY_BOTTOM := Color("#7d8794")
const FOG_FAR := Color(0.58, 0.62, 0.67, 0.45)
const FOG_NEAR := Color(0.71, 0.73, 0.77, 0.30)
const MOUNTAINS := Color("#4b566b")
const ROAD := Color("#474d59")
const ROAD_LINE := Color("#8b93a0")
const OFF_WHITE := Color("#e6e8ec")
const WARM_WHITE := Color("#dcd6c8")
const LIGHT_GRAY := Color("#a7adb8")
const COOL_GRAY := Color("#7d8591")
const DARK_GRAY := Color("#4a505c")
const CHARCOAL := Color("#24272f")
const GREEN := Color("#6d8177")
const GREEN_DARK := Color("#546156")
const PUDDLE := Color("#5f6b7a")
const WINDOW := Color("#f0d9a3")
const SKIN := Color("#e4d8cc")
const HAIR := Color("#1b1d22")

var viewport_size := Vector2(1080, 1920)
var elapsed := 0.0
var game_over := false
var touch_points := {}
var touch_jump_queued := false

var world_x := 0.0
var speed := 118.0
var wetness := 0.0
var walk_cycle := 0.0
var bob := 0.0
var leg_swing := 0.0
var is_jumping := false
var jump_t := 0.0
var jump_duration := 0.42
var jump_height := 30.0

var umbrella_angle := 0.0
var umbrella_vel := 0.0
var umbrella_max_angle := 62.0
var umbrella_max_speed := 150.0
var umbrella_length := 58.0
var umbrella_half_width := 21.0

var camera_x := 0.0
var camera_y := 0.0
var last_camera_x := 0.0
var puddles_cleared := 0

var wind_angle := 0.0
var wind_target := 0.0
var wind_timer := 6.0
var wind_states := [-58.0, -38.0, -16.0, 0.0, 16.0, 38.0, 58.0]

var chunks := {}
var rain_layers := {}
var splashes: Array = []

@onready var rain_audio: AudioStreamPlayer = $RainAudio
@onready var umbrella_audio: AudioStreamPlayer = $UmbrellaAudio

func _ready() -> void:
	randomize()
	viewport_size = get_viewport_rect().size
	_build_rain()
	_resize_rain()
	if rain_audio:
		rain_audio.play()

func _process(delta: float) -> void:
	delta = minf(delta, 0.1)
	var current_size := get_viewport_rect().size
	if current_size != viewport_size:
		viewport_size = current_size
		_resize_rain()
	if game_over and (Input.is_key_pressed(KEY_R) or touch_jump_queued):
		_restart()
		touch_jump_queued = false
	_update_game(delta)
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			touch_points[event.index] = event.position
			if _jump_button_rect().has_point(event.position):
				touch_jump_queued = true
		else:
			touch_points.erase(event.index)
	elif event is InputEventScreenDrag:
		touch_points[event.index] = event.position

func _update_game(delta: float) -> void:
	_update_wind(delta)
	if not game_over:
		elapsed += delta
		_update_player(delta)
		_update_camera(delta)
	else:
		bob = damp(bob, 0.0, 6.0, delta)
		leg_swing = damp(leg_swing, 0.0, 6.0, delta)

	var cam_delta := camera_x - last_camera_x
	last_camera_x = camera_x
	_update_rain(delta, cam_delta)
	_ensure_chunks(camera_x - 180.0, camera_x + viewport_size.x + 180.0)
	if not game_over:
		_resolve_puddles()
		_resolve_rain_hits()
		if wetness >= 100.0:
			game_over = true

func _update_player(delta: float) -> void:
	world_x += speed * delta
	walk_cycle += delta * (speed / 18.0)
	bob = sin(walk_cycle * 2.0) * 3.2
	leg_swing = sin(walk_cycle * 2.0) * 10.0

	var axis := _touch_axis()
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		axis -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		axis += 1.0
	axis = clampf(axis, -1.0, 1.0)
	if axis != 0.0:
		umbrella_vel = damp(umbrella_vel, axis * umbrella_max_speed, 11.0, delta)
		if umbrella_audio and absf(umbrella_vel) > 60.0 and randf() < 0.025:
			umbrella_audio.play()
	else:
		umbrella_vel *= maxf(0.0, 1.0 - 4.6 * delta)
	umbrella_angle += umbrella_vel * delta
	if umbrella_angle > umbrella_max_angle:
		umbrella_angle = umbrella_max_angle
		umbrella_vel = 0.0
	if umbrella_angle < -umbrella_max_angle:
		umbrella_angle = -umbrella_max_angle
		umbrella_vel = 0.0

	var jump_pressed := touch_jump_queued or Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)
	touch_jump_queued = false
	if jump_pressed and not is_jumping:
		is_jumping = true
		jump_t = 0.0
	if is_jumping:
		jump_t += delta
		if jump_t >= jump_duration:
			is_jumping = false
			jump_t = 0.0

func _update_camera(delta: float) -> void:
	var desired_x := world_x - viewport_size.x * _camera_anchor_frac()
	camera_x = damp(camera_x, desired_x, 4.2, delta)
	camera_y = damp(camera_y, -road_elevation(world_x), 3.0, delta)

func _update_wind(delta: float) -> void:
	wind_timer -= delta
	if wind_timer <= 0.0:
		wind_target = wind_states[randi() % wind_states.size()]
		wind_timer = randf_range(6.0, 11.0)
	wind_angle = damp(wind_angle, wind_target, 0.6, delta)

func _draw() -> void:
	_draw_sky()
	_draw_mountains()
	_draw_fog()
	_draw_rain_layer("bg", COOL_GRAY)
	_draw_guardrail()
	_draw_road()
	_draw_poles_and_wires()
	_draw_world_objects()
	_draw_player()
	_draw_rain_layer("mid", COOL_GRAY)
	_draw_splashes()
	_draw_rain_layer("fg", CHARCOAL)
	_draw_ui()
	_draw_vignette()

func _draw_sky() -> void:
	for i in range(36):
		var t := float(i) / 35.0
		var col := SKY_TOP.lerp(SKY_BOTTOM, t)
		var y := viewport_size.y * t
		draw_rect(Rect2(0.0, y, viewport_size.x, viewport_size.y / 35.0 + 1.0), col)

func _draw_mountains() -> void:
	var base_y := viewport_size.y * _baseline_frac() - 40.0
	var points := PackedVector2Array()
	points.append(Vector2(0, base_y + 60.0))
	for sx in range(-60, int(viewport_size.x) + 121, 60):
		var wx := (camera_x + sx) * 0.15
		var y := base_y - 34.0 - sin(wx * 0.01) * 22.0 - sin(wx * 0.023 + 2.0) * 12.0
		points.append(Vector2(sx, y))
	points.append(Vector2(viewport_size.x + 60.0, base_y + 60.0))
	draw_colored_polygon(points, Color(MOUNTAINS, 0.55))

func _draw_fog() -> void:
	draw_rect(Rect2(0, viewport_size.y * 0.30, viewport_size.x, viewport_size.y * 0.18), FOG_FAR)
	draw_rect(Rect2(0, viewport_size.y * 0.55, viewport_size.x, viewport_size.y * 0.14), FOG_NEAR)

func _draw_road() -> void:
	var top := PackedVector2Array()
	var bottom: Array[Vector2] = []
	var samples := 48
	var start_x := camera_x - 120.0
	var end_x := camera_x + viewport_size.x + 120.0
	for i in range(samples + 1):
		var wx := lerpf(start_x, end_x, float(i) / samples)
		var sx := wx - camera_x
		var sy := road_screen_y(wx)
		top.append(Vector2(sx, sy - 30.0))
		bottom.append(Vector2(sx, sy + 34.0))
	for i in range(bottom.size() - 1, -1, -1):
		top.append(bottom[i])
	draw_colored_polygon(top, ROAD)

	for wx in range(int(start_x / 40.0) * 40, int(end_x) + 40, 40):
		var sx1 := float(wx) - camera_x
		var sx2 := sx1 + 18.0
		var sy1 := road_screen_y(float(wx))
		var sy2 := road_screen_y(float(wx) + 18.0)
		draw_line(Vector2(sx1, sy1), Vector2(sx2, sy2), Color(ROAD_LINE, 0.5), 3.0)

func _draw_guardrail() -> void:
	var post_spacing := 46.0
	var first := floori((camera_x - 60.0) / post_spacing)
	var last := ceili((camera_x + viewport_size.x + 60.0) / post_spacing)
	var prev := Vector2.ZERO
	var has_prev := false
	for p in range(first, last + 1):
		var wx := p * post_spacing
		var sx := wx - camera_x
		var sy := road_screen_y(wx) + 30.0
		draw_line(Vector2(sx, sy), Vector2(sx, sy - 16.0), Color(CHARCOAL, 0.55), 2.0)
		if has_prev:
			draw_line(Vector2(prev.x, prev.y - 12.0), Vector2(sx, sy - 12.0), Color(CHARCOAL, 0.55), 2.0)
		prev = Vector2(sx, sy)
		has_prev = true

func _draw_poles_and_wires() -> void:
	var spacing := 340.0
	var first := floori((camera_x - 200.0) / spacing)
	var last := ceili((camera_x + viewport_size.x + 200.0) / spacing)
	var tops: Array[Vector2] = []
	for p in range(first, last + 1):
		var wx := p * spacing + (p % 3) * 18.0 - 9.0
		var sx := wx - camera_x
		var ground_y := road_screen_y(wx) - 26.0
		var top_y := ground_y - 92.0
		draw_line(Vector2(sx, ground_y), Vector2(sx, top_y), Color(DARK_GRAY, 0.5), 3.0)
		draw_line(Vector2(sx - 12.0, top_y + 8.0), Vector2(sx + 12.0, top_y + 8.0), Color(DARK_GRAY, 0.5), 3.0)
		tops.append(Vector2(sx, top_y + 8.0))
	for i in range(tops.size() - 1):
		var a := tops[i]
		var b := tops[i + 1]
		var mid := (a + b) * 0.5
		mid.y += 14.0 + sin(elapsed * 0.6 + i) * 1.5
		_draw_polyline(_quad_points(a, mid, b, 18), Color(DARK_GRAY, 0.4), 1.4)

func _draw_world_objects() -> void:
	var min_x := camera_x - 160.0
	var max_x := camera_x + viewport_size.x + 160.0
	var first := floori(min_x / CHUNK_WIDTH)
	var last := floori(max_x / CHUNK_WIDTH)
	for ci in range(first, last + 1):
		var chunk: Dictionary = _get_chunk(ci)
		var base := ci * CHUNK_WIDTH
		for p in chunk.puddles:
			var wx: float = base + p.local_x
			var sx := wx - camera_x
			var sy := road_screen_y(wx) + 20.0
			_draw_puddle(sx, sy, p.width, p.seed)
		for o in chunk.objects:
			var wx: float = base + o.local_x
			var sx := wx - camera_x
			if sx < -140.0 or sx > viewport_size.x + 140.0:
				continue
			var road_y := road_screen_y(wx)
			var sy := road_y - 6.0 if o.side > 0 else road_y + 30.0
			_draw_object(o.type, sx, sy, o.scale, o.seed)

func _draw_puddle(sx: float, sy: float, width: float, seed: float) -> void:
	draw_set_transform(Vector2(sx, sy), 0.0, Vector2(1.0, 0.28))
	draw_circle(Vector2.ZERO, width * 0.5, Color(PUDDLE, 0.5))
	var ring_t := fmod(elapsed * 0.5 + seed * 10.0, 1.4)
	draw_arc(Vector2.ZERO, width * 0.5 * ring_t * 0.8, 0.0, TAU, 36, Color(OFF_WHITE, 0.35), 1.2)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw_object(kind: String, sx: float, sy: float, scale_value: float, seed: float) -> void:
	draw_set_transform(Vector2(sx, sy), 0.0, Vector2(scale_value, scale_value))
	match kind:
		"house":
			draw_rect(Rect2(-37, -58, 74, 58), WARM_WHITE)
			draw_colored_polygon(PackedVector2Array([Vector2(-45, -58), Vector2(0, -86), Vector2(45, -58)]), DARK_GRAY)
			draw_rect(Rect2(-27, -44, 14, 14), Color(WINDOW, 0.85))
			draw_rect(Rect2(13, -44, 14, 14), Color(WINDOW, 0.85))
		"tree":
			draw_rect(Rect2(-3, -30, 6, 30), DARK_GRAY)
			draw_circle(Vector2(0, -40), 22.0, Color(GREEN, 0.9))
		"bush":
			draw_circle(Vector2(-10, -8), 12, Color(GREEN_DARK, 0.85))
			draw_circle(Vector2(6, -10), 14, Color(GREEN_DARK, 0.85))
			draw_circle(Vector2(14, -6), 10, Color(GREEN_DARK, 0.85))
		"fenceRun":
			for i in range(-2, 3):
				draw_line(Vector2(i * 12, -2), Vector2(i * 12, -24), Color(COOL_GRAY, 0.7), 2)
			draw_line(Vector2(-26, -20), Vector2(26, -20), Color(COOL_GRAY, 0.7), 2)
			draw_line(Vector2(-26, -6), Vector2(26, -6), Color(COOL_GRAY, 0.7), 2)
		"mailbox":
			draw_rect(Rect2(-4, -24, 8, 24), COOL_GRAY)
			draw_rect(Rect2(-9, -34, 18, 12), COOL_GRAY)
		"vending":
			draw_rect(Rect2(-13, -46, 26, 46), LIGHT_GRAY)
			draw_rect(Rect2(-9, -40, 18, 26), Color(WINDOW, 0.7))
		"bicycle":
			draw_arc(Vector2(-11, -8), 8, 0, TAU, 24, Color(CHARCOAL, 0.75), 2)
			draw_arc(Vector2(11, -8), 8, 0, TAU, 24, Color(CHARCOAL, 0.75), 2)
			draw_line(Vector2(-11, -8), Vector2(0, -20), Color(CHARCOAL, 0.75), 2)
			draw_line(Vector2(0, -20), Vector2(11, -8), Color(CHARCOAL, 0.75), 2)
			draw_line(Vector2(11, -8), Vector2(-11, -8), Color(CHARCOAL, 0.75), 2)
		_:
			draw_line(Vector2(0, 0), Vector2(0, -48), Color(DARK_GRAY, 0.7), 2.5)
			draw_circle(Vector2(0, -52), 5, OFF_WHITE)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw_player() -> void:
	var px := world_x - camera_x
	var py := road_screen_y(world_x) + 30.0
	var jump_y := -jump_offset()
	var wind_lean := clampf(wind_angle / 60.0, -1.0, 1.0)
	var hair_sway := sin(walk_cycle * 1.4) * 2.2 + wind_lean * 2.4
	draw_set_transform(Vector2(px, py + bob + jump_y), 0.0, Vector2.ONE)

	draw_line(Vector2(-3, -20), Vector2(-3 + leg_swing * 0.3, -1), Color(CHARCOAL, 0.85), 4.0)
	draw_line(Vector2(3, -20), Vector2(3 - leg_swing * 0.3, -1), Color(CHARCOAL, 0.85), 4.0)
	draw_circle(Vector2(-3 + leg_swing * 0.3, 0), 3.2, Color(OFF_WHITE, 0.9))
	draw_circle(Vector2(3 - leg_swing * 0.3, 0), 3.2, Color(OFF_WHITE, 0.9))

	var skirt_sway := leg_swing * 0.14
	draw_colored_polygon(PackedVector2Array([Vector2(-9, -30), Vector2(9, -30), Vector2(12 + skirt_sway, -12), Vector2(-12 + skirt_sway, -12)]), Color(DARK_GRAY, 0.95))
	draw_rect(Rect2(-12, -52, 24, 24), Color(OFF_WHITE, 0.97))
	draw_line(Vector2(-6, -52), Vector2(0, -44), Color(CHARCOAL, 0.5), 1.3)
	draw_line(Vector2(0, -44), Vector2(6, -52), Color(CHARCOAL, 0.5), 1.3)
	draw_colored_polygon(PackedVector2Array([Vector2(0, -44), Vector2(-2.4, -39), Vector2(2.4, -39)]), Color(CHARCOAL, 0.45))
	draw_circle(Vector2(0, -58), 8.5, SKIN)
	draw_colored_polygon(_hair_side(-1, hair_sway), Color(HAIR, 0.95))
	draw_colored_polygon(_hair_side(1, hair_sway), Color(HAIR, 0.95))
	draw_arc(Vector2(0, -61), 8.7, PI, TAU, 18, Color(HAIR, 0.95), 8.0)
	draw_circle(Vector2(3.2, -58), 0.85, Color(CHARCOAL, 0.5))

	draw_set_transform(Vector2(px, py + bob + jump_y - 50.0), deg_to_rad(umbrella_angle), Vector2.ONE)
	draw_line(Vector2.ZERO, Vector2(0, -umbrella_length), DARK_GRAY, 3.0)
	var canopy := PackedVector2Array([Vector2(-umbrella_half_width, -umbrella_length)])
	for i in range(20):
		var a := PI + (float(i) / 19.0) * PI
		canopy.append(Vector2(cos(a) * umbrella_half_width, -umbrella_length + sin(a) * umbrella_half_width))
	canopy.append(Vector2(umbrella_half_width, -umbrella_length))
	draw_colored_polygon(canopy, Color(OFF_WHITE, 0.94))
	draw_arc(Vector2(0, -umbrella_length), umbrella_half_width, PI, TAU, 24, Color(COOL_GRAY, 0.6), 1.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw_rain_layer(key: String, color: Color) -> void:
	var layer: Dictionary = rain_layers[key]
	var dir := rain_direction()
	for i in range(layer.count):
		var p := Vector2(layer.x[i], layer.y[i])
		draw_line(p, p - dir * layer.len[i], Color(color, layer.alpha), layer.width)

func _draw_splashes() -> void:
	for p in splashes:
		if not p.active:
			continue
		var a: float = 1.0 - p.life / p.max_life
		draw_circle(Vector2(p.x, p.y), p.size, Color(OFF_WHITE, a * 0.7))

func _draw_ui() -> void:
	var margin := 28.0
	var panel_w := minf(324.0, viewport_size.x - margin * 2.0)
	var panel := Rect2(margin, 28, panel_w, 92)
	draw_rect(panel, Color(0.12, 0.14, 0.18, 0.58))
	draw_rect(panel, Color(1, 1, 1, 0.10), false, 2.0)
	var labels := ["DISTANCE", "DRYNESS", "TIME"]
	var values := ["%d m" % int(world_x / 12.0), "%d%%" % int(100.0 - wetness), _clock(elapsed)]
	for i in range(3):
		var x := panel.position.x + 28.0 + i * ((panel_w - 56.0) / 3.0)
		draw_string(ThemeDB.fallback_font, Vector2(x, 60), labels[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(OFF_WHITE, 0.72))
		draw_string(ThemeDB.fallback_font, Vector2(x, 92), values[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 26, OFF_WHITE)
	draw_arc(Vector2(viewport_size.x - 54.0, 54.0), 26.0, 0.0, TAU, 32, Color(1, 1, 1, 0.10), 2.0)
	draw_string(ThemeDB.fallback_font, Vector2(viewport_size.x - 66.0, 60.0), "...", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, OFF_WHITE)
	_draw_touch_controls()
	if game_over:
		draw_rect(Rect2(Vector2.ZERO, viewport_size), Color(0.08, 0.09, 0.11, 0.45))
		draw_string(ThemeDB.fallback_font, Vector2(viewport_size.x * 0.5 - 92, viewport_size.y * 0.45), "SOAKED", HORIZONTAL_ALIGNMENT_LEFT, -1, 42, OFF_WHITE)
		draw_string(ThemeDB.fallback_font, Vector2(viewport_size.x * 0.5 - 134, viewport_size.y * 0.50), "Tap jump or press R", HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(OFF_WHITE, 0.8))

func _draw_vignette() -> void:
	draw_rect(Rect2(Vector2.ZERO, viewport_size), Color(0.05, 0.06, 0.08, 0.08))

func _draw_touch_controls() -> void:
	var left_rect := _left_button_rect()
	var right_rect := _right_button_rect()
	var jump_rect := _jump_button_rect()
	_draw_touch_button(left_rect, "<")
	_draw_touch_button(right_rect, ">")
	_draw_touch_button(jump_rect, "^")

func _draw_touch_button(rect: Rect2, label: String) -> void:
	var center := rect.get_center()
	var radius := minf(rect.size.x, rect.size.y) * 0.5
	draw_circle(center, radius, Color(0.12, 0.14, 0.18, 0.34))
	draw_arc(center, radius, 0.0, TAU, 40, Color(1, 1, 1, 0.16), 2.0)
	draw_string(ThemeDB.fallback_font, center + Vector2(-9.0, 10.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, Color(OFF_WHITE, 0.65))

func _build_rain() -> void:
	rain_layers = {
		"bg": _make_layer(90, 340.0, 6.0, 11.0, 0.22, 1.0, 0.12),
		"mid": _make_layer(180, 520.0, 10.0, 16.0, 0.42, 1.4, 0.04),
		"fg": _make_layer(70, 760.0, 16.0, 26.0, 0.65, 2.1, 0.02),
	}
	for i in range(220):
		splashes.append({"active": false, "x": 0.0, "y": 0.0, "vx": 0.0, "vy": 0.0, "life": 0.0, "max_life": 1.0, "size": 1.0, "scored": false})

func _make_layer(count: int, fall_speed: float, len_min: float, len_max: float, alpha: float, width: float, parallax: float) -> Dictionary:
	return {
		"count": count, "fall_speed": fall_speed, "len_min": len_min, "len_max": len_max,
		"alpha": alpha, "width": width, "parallax": parallax,
		"x": PackedFloat32Array(), "y": PackedFloat32Array(), "speed_mul": PackedFloat32Array(),
		"len": PackedFloat32Array(), "hit": PackedByteArray()
	}

func _resize_rain() -> void:
	for key in rain_layers.keys():
		var layer: Dictionary = rain_layers[key]
		layer.x.resize(layer.count)
		layer.y.resize(layer.count)
		layer.speed_mul.resize(layer.count)
		layer.len.resize(layer.count)
		layer.hit.resize(layer.count)
		for i in range(layer.count):
			layer.x[i] = randf() * (viewport_size.x + 400.0) - 200.0
			layer.y[i] = randf() * viewport_size.y
			layer.speed_mul[i] = 0.85 + randf() * 0.3
			layer.len[i] = randf_range(layer.len_min, layer.len_max)
			layer.hit[i] = 0

func _update_rain(delta: float, cam_delta: float) -> void:
	var dir := rain_direction()
	for key in rain_layers.keys():
		var layer: Dictionary = rain_layers[key]
		for i in range(layer.count):
			layer.x[i] += dir.x * layer.fall_speed * layer.speed_mul[i] * delta - cam_delta * layer.parallax
			layer.y[i] += dir.y * layer.fall_speed * layer.speed_mul[i] * delta
			if layer.y[i] > viewport_size.y + 20.0:
				layer.y[i] = -20.0 - randf() * 60.0
				layer.x[i] = randf() * (viewport_size.x + 400.0) - 200.0
				layer.hit[i] = 0
				if key != "bg" and randf() < 0.5:
					_spawn_splash(layer.x[i], viewport_size.y - 4.0 + randf() * 4.0, dir.x, 1, 0.8)
			if layer.x[i] < -220.0:
				layer.x[i] += viewport_size.x + 400.0
			if layer.x[i] > viewport_size.x + 220.0:
				layer.x[i] -= viewport_size.x + 400.0
	for p in splashes:
		if not p.active:
			continue
		p.life += delta
		if p.life >= p.max_life:
			p.active = false
			continue
		p.vy += 260.0 * delta
		p.x += p.vx * delta
		p.y += p.vy * delta

func _spawn_splash(x: float, y: float, dir_x: float, count: int, spread: float) -> void:
	var spawned := 0
	for p in splashes:
		if spawned >= count:
			return
		if p.active:
			continue
		p.active = true
		p.x = x
		p.y = y
		var angle := -PI * 0.5 + (randf() - 0.5) * spread + dir_x * 0.6
		var s := 40.0 + randf() * 70.0
		p.vx = cos(angle) * s + dir_x * 60.0
		p.vy = sin(angle) * s
		p.life = 0.0
		p.max_life = 0.35 + randf() * 0.25
		p.size = 1.5 + randf() * 2.0
		p.scored = false
		spawned += 1

func _resolve_rain_hits() -> void:
	var px := world_x - camera_x
	var py := road_screen_y(world_x) + 30.0
	var pivot := Vector2(px, py - 50.0)
	var body_min_x := px - 15.0
	var body_max_x := px + 15.0
	var body_min_y := py - 68.0
	var body_max_y := py + 6.0
	var hits := 0.0
	for key in ["mid", "fg"]:
		var layer: Dictionary = rain_layers[key]
		for i in range(layer.count):
			if layer.hit[i] != 0:
				continue
			var x: float = layer.x[i]
			var y: float = layer.y[i]
			if x < px - 70.0 or x > px + 70.0 or y < body_min_y - 40.0 or y > body_max_y:
				continue
			if _umbrella_shields(Vector2(x, y) - pivot):
				layer.hit[i] = 1
			elif x >= body_min_x and x <= body_max_x and y >= body_min_y and y <= body_max_y:
				layer.hit[i] = 1
				hits += 1.0
	for p in splashes:
		if not p.active or p.scored:
			continue
		if p.x < px - 70.0 or p.x > px + 70.0 or p.y < body_min_y - 20.0 or p.y > body_max_y + 10.0:
			continue
		if _umbrella_shields(Vector2(p.x, p.y) - pivot):
			p.scored = true
		elif p.x >= body_min_x and p.x <= body_max_x and p.y >= body_min_y - 10.0 and p.y <= body_max_y + 10.0:
			p.scored = true
			hits += 1.4
	if hits > 0.0:
		wetness = clampf(wetness + hits * 1.6, 0.0, 100.0)

func _resolve_puddles() -> void:
	var min_x := camera_x - 160.0
	var max_x := camera_x + viewport_size.x + 160.0
	var first := floori(min_x / CHUNK_WIDTH)
	var last := floori(max_x / CHUNK_WIDTH)
	for ci in range(first, last + 1):
		var chunk := _get_chunk(ci)
		var base := ci * CHUNK_WIDTH
		for p in chunk.puddles:
			if p.resolved:
				continue
			var px: float = base + float(p.local_x)
			var range_min: float = px - float(p.width) * 0.5 - 6.0
			var range_max: float = px + float(p.width) * 0.5 + 6.0
			if world_x < range_min:
				continue
			if world_x <= range_max and is_jumping:
				p.resolved = true
				puddles_cleared += 1
			elif world_x > range_max:
				p.resolved = true
				wetness = clampf(wetness + 5.0, 0.0, 100.0)
				_spawn_splash(px - camera_x, road_screen_y(px) + 20.0, 0.0, 8, 1.2)

func _umbrella_shields(delta: Vector2) -> bool:
	var rad := deg_to_rad(umbrella_angle)
	var rx := delta.x * cos(rad) + delta.y * sin(rad)
	var ry := -delta.x * sin(rad) + delta.y * cos(rad)
	var dome_y := -umbrella_length
	var forgiveness := 5.0
	if ry < 0.0 and ry >= dome_y and rx > -umbrella_half_width and rx < umbrella_half_width:
		return true
	if ry <= dome_y + forgiveness:
		var d := Vector2(rx, ry - dome_y)
		return d.length_squared() <= pow(umbrella_half_width + forgiveness, 2.0)
	return false

func _ensure_chunks(min_x: float, max_x: float) -> void:
	var first := floori(min_x / CHUNK_WIDTH) - 1
	var last := ceili(max_x / CHUNK_WIDTH) + 1
	for i in range(first, last + 1):
		_get_chunk(i)

func _get_chunk(index: int) -> Dictionary:
	if chunks.has(index):
		return chunks[index]
	var rng := RandomNumberGenerator.new()
	rng.seed = int(index * 7919 + 13)
	var objects: Array = []
	var right_types := ["house", "house", "house", "tree", "tree", "tree", "bush", "bush", "bush", "fenceRun", "fenceRun", "mailbox", "vending", "bicycle", "lampRight"]
	var left_types := ["mirror", "sign", "lampLeft", "none", "none", "none"]
	var right_count := 3 + rng.randi_range(0, 3)
	for i in range(right_count):
		objects.append({"side": 1, "type": right_types[rng.randi_range(0, right_types.size() - 1)], "local_x": rng.randf() * CHUNK_WIDTH, "scale": 0.8 + rng.randf() * 0.5, "seed": rng.randf()})
	var left_count := 1 + rng.randi_range(0, 1)
	for i in range(left_count):
		var type: String = left_types[rng.randi_range(0, left_types.size() - 1)]
		if type != "none":
			objects.append({"side": -1, "type": type, "local_x": rng.randf() * CHUNK_WIDTH, "scale": 0.9 + rng.randf() * 0.3, "seed": rng.randf()})
	var puddles: Array = []
	var roll := rng.randf()
	var puddle_count := 1 if roll < 0.6 else (2 if roll < 0.85 else 0)
	for i in range(puddle_count):
		puddles.append({"local_x": 60.0 + rng.randf() * (CHUNK_WIDTH - 120.0), "width": 34.0 + rng.randf() * 46.0, "seed": rng.randf(), "resolved": false})
	chunks[index] = {"objects": objects, "puddles": puddles}
	return chunks[index]

func _restart() -> void:
	elapsed = 0.0
	game_over = false
	world_x = 0.0
	wetness = 0.0
	walk_cycle = 0.0
	camera_x = 0.0
	camera_y = 0.0
	last_camera_x = 0.0
	umbrella_angle = 0.0
	umbrella_vel = 0.0
	puddles_cleared = 0
	chunks.clear()
	_resize_rain()

func road_elevation(x: float) -> float:
	return sin(x * 0.0012) * 46.0 + sin(x * 0.0037 + 1.7) * 22.0 + sin(x * 0.0009 + 4.1) * 30.0

func road_screen_y(x: float) -> float:
	return viewport_size.y * _baseline_frac() - (road_elevation(x) + camera_y)

func rain_direction() -> Vector2:
	var rad := deg_to_rad(wind_angle)
	return Vector2(-sin(rad), cos(rad))

func _is_portrait() -> bool:
	return viewport_size.y > viewport_size.x

func _baseline_frac() -> float:
	return 0.68 if _is_portrait() else 0.60

func _camera_anchor_frac() -> float:
	return 0.46 if _is_portrait() else 0.35

func _touch_axis() -> float:
	var axis := 0.0
	for pos in touch_points.values():
		if _left_button_rect().has_point(pos):
			axis -= 1.0
		if _right_button_rect().has_point(pos):
			axis += 1.0
	return clampf(axis, -1.0, 1.0)

func _control_radius() -> float:
	return clampf(viewport_size.x * 0.085, 58.0, 92.0)

func _left_button_rect() -> Rect2:
	var r := _control_radius()
	var center := Vector2(r + 36.0, viewport_size.y - r - 52.0)
	return Rect2(center - Vector2(r, r), Vector2(r * 2.0, r * 2.0))

func _right_button_rect() -> Rect2:
	var r := _control_radius()
	var center := Vector2(r * 3.25 + 46.0, viewport_size.y - r - 52.0)
	return Rect2(center - Vector2(r, r), Vector2(r * 2.0, r * 2.0))

func _jump_button_rect() -> Rect2:
	var r := _control_radius()
	var center := Vector2(viewport_size.x - r - 42.0, viewport_size.y - r - 52.0)
	return Rect2(center - Vector2(r, r), Vector2(r * 2.0, r * 2.0))

func jump_offset() -> float:
	if not is_jumping:
		return 0.0
	return sin(clampf(jump_t / jump_duration, 0.0, 1.0) * PI) * jump_height

func damp(a: float, b: float, lambda: float, delta: float) -> float:
	return lerpf(a, b, 1.0 - exp(-lambda * delta))

func _clock(seconds: float) -> String:
	return "%02d:%02d" % [int(seconds / 60.0), int(seconds) % 60]

func _quad_points(a: Vector2, b: Vector2, c: Vector2, steps: int) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in range(steps + 1):
		var t := float(i) / steps
		pts.append(a.lerp(b, t).lerp(b.lerp(c, t), t))
	return pts

func _draw_polyline(points: PackedVector2Array, color: Color, width: float) -> void:
	for i in range(points.size() - 1):
		draw_line(points[i], points[i + 1], color, width)

func _hair_side(side: int, sway: float) -> PackedVector2Array:
	if side < 0:
		return PackedVector2Array([Vector2(-8, -63), Vector2(-11 + sway * 0.5, -50), Vector2(-9 + sway, -27), Vector2(-4, -30), Vector2(-6, -50)])
	return PackedVector2Array([Vector2(8, -63), Vector2(11 + sway * 0.5, -50), Vector2(9 + sway, -27), Vector2(4, -30), Vector2(6, -50)])
