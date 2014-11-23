var gl;

function panic(msg) {
	alert(msg);
	throw msg;
};

function Shader(id, attributes) {
	var get_script = function (id) {
		var e = document.getElementById(id);
		if (!e) panic(id + " not found");
		return e.innerHTML;
	};

	var create_shader = function (type, src) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, src);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			panic(gl.getShaderInfoLog(shader));
		}
		return shader;
	};

	var vs = create_shader(gl.VERTEX_SHADER, get_script(id + "-vs"));
	var fs = create_shader(gl.FRAGMENT_SHADER, get_script(id + "-fs"));

	var prg = gl.createProgram();
	gl.attachShader(prg, vs);
	gl.attachShader(prg, fs);
	gl.linkProgram(prg);

	if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) panic("link error");

	var attribs = (function () {
		var total = 0;
		var args = [];
		for (var i in attributes) {
			var name = attributes[i][0];
			var length = attributes[i][1];
			args.push({
				"loc": gl.getAttribLocation(prg, name),
				"length": length,
				"offset": total * 4
			});
			total += length;
		}
		return {
			"stride": total * 4,
			"args": args
		};
	})();

	this.setup_vertex_attrib_pointers = function () {
		for (var i in attribs.args) {
			var args = attribs.args[i];
			gl.vertexAttribPointer(
				args.loc,
				args.length,
				gl.FLOAT,
				false,
				attribs.stride,
				args.offset
			);
		};
	};

	var ucache = {};
	var uniform = function (name) {
		if (!ucache[name]) {
			ucache[name] = gl.getUniformLocation(prg, name);
		}
		return ucache[name];
	};

	this.set_uniform_matrix = function (name, value) {
		gl.uniformMatrix4fv(uniform(name), false, new Float32Array(value));
	};

	this.set_uniform_float = function (name, value) {
		gl.uniform1f(uniform(name), value);
	}

	this.set_uniform_int = function (name, value) {
		gl.uniform1i(uniform(name), value);
	}

	this.enable = function () {
		gl.useProgram(prg);
		for (var i in attribs.args) {
			gl.enableVertexAttribArray(attribs.args[i].loc);
		}
	};

	this.disable = function () {
		for (var i in attribs.args) {
			gl.disableVertexAttribArray(attribs.args[i].loc);
		}
	};
};

function deg2rad(deg) {
	return deg / 180 * Math.PI;
}

function rad2deg(rad) {
	return rad / Math.PI * 180;
}

function m4ati(col, row) {
	return row + col*4;
}

function m4identity() {
	var m = [];
	for (var col = 0; col < 4; col++) {
		for (var row = 0; row < 4; row++) {
			m.push(row == col ? 1 : 0);
		}
	}
	return m;
}

function m4zero() {
	var m = [];
	for (var col = 0; col < 4; col++) {
		for (var row = 0; row < 4; row++) {
			m.push(0);
		}
	}
	return m;
}

function m4mul(a, b) {
	var m = [];
	for (var col = 0; col < 4; col++) {
		for (var row = 0; row < 4; row++) {
			m.push(v4dot(m4row(a,row), m4col(b,col)));
		}
	}
	return m;
};

function m4rotation(axis, phi) {
	var m = m4identity();
	var c = Math.cos(deg2rad(phi));
	var s = Math.sin(deg2rad(phi));
	var c1 = 1-c;
	for (var col = 0; col < 3; col++) {
		for (var row = 0; row < 3; row++) {
			var v = axis[col] * axis[row] * c1;
			if (col == row) {
				v += c;
			} else {
				var i = 3 - row - col;
				var sgn1 = ((col + row)&1) ? 1 : -1;
				var sgn2 = row>col ? 1 : -1;
				v += sgn1 * sgn2 * axis[i] * s;
			}
			m[m4ati(col,row)] = v;
		}
	}
	return m;
}

function m4translation(v4) {
	var m = m4identity();
	for (var row = 0; row < 3; row++) {
		m[m4ati(3,row)] = v4[row];
	}
	return m;
}

function m4frustum(left, right, down, up, znear, zfar) {
	var m = m4zero();

	m[m4ati(0,0)] = 2 * znear / (right - left);
	m[m4ati(1,1)] = 2 * znear / (up - down);

	m[m4ati(2,0)] = (right+left)/(right-left); // A
	m[m4ati(2,1)] = (up+down)/(up-down); // B
	m[m4ati(2,2)] = -((zfar+znear)/(zfar-znear)); // C
	m[m4ati(2,3)] = -1;

	m[m4ati(3,2)] = -(2 * zfar * znear / (zfar - znear)); // D

	return m;
};

function m4perspective(fovy, aspect, znear, zfar) {
	var dy = znear * Math.tan(deg2rad(fovy)/2);
	var dx = dy * aspect;
	return m4frustum(-dx, dx, -dy, dy, znear, zfar);
}

function m4row(m4, row) {
	var v4 = [];
	for (var col = 0; col < 4; col++) {
		v4.push(m4[m4ati(col, row)]);
	}
	return v4;
}

function m4col(m4, col) {
	var v4 = [];
	for (var row = 0; row < 4; row++) {
		v4.push(m4[m4ati(col, row)]);
	}
	return v4;
}

function v4dot(a,b) {
	var v = 0;
	for (var i = 0; i < 4; i++) {
		v += a[i]*b[i];
	}
	return v;
}

function v3dot(a,b) {
	var v = 0;
	for (var i = 0; i < 3; i++) {
		v += a[i]*b[i];
	}
	return v;
}

function v3len(v3) {
	return Math.sqrt(v3dot(v3,v3));
}

function v3apply(v3, m4) {
	var v4 = [v3[0],v3[1],v3[2],1];
	var r4 = [];
	for (var i = 0; i < 4; i++) {
		var row = m4row(m4, i);
		r4.push(v4dot(v4,row));
	}
	return [r4[0]/r4[3], r4[1]/r4[3], r4[2]/r4[3]];
}

function v3rotate(v3, axis, phi) {
	return v3apply(v3, m4rotation(axis, phi));
}

function v3cross(a, b) {
	var r = [];
	for (var i = 0; i < 3; i++) {
		var i1 = (i+1)%3;
		var i2 = (i+2)%3;
		r.push(a[i1]*b[i2] - a[i2]*b[i1]);
	}
	return r;
}

function v3normalize(v3) {
	var s = 1/v3len(v3);
	var r = [];
	for (var i = 0; i < 3; i++) {
		r.push(v3[i] * s);
	}
	return r;
}

function v3add(a, b) {
	var s = [];
	for (var i = 0; i < 3; i++) {
		s.push(a[i] + b[i]);
	}
	return s;
}

function v3scale(v3, scalar) {
	return v3.map(function (v) { return v * scalar; });
}

function Orbits(data0) {
	var epoch = data0._epoch;
	delete data0._epoch;

	var G = 6.6738480e-11; // gravitational constant
	var Me = 5.97219e24; // mass of earth
	var ds = 24*60*60; // seconds per day
	var mu = G*Me;
	var dm = Math.pow(ds,2/3) * Math.pow(mu,1/3);
	var k = Math.pow(4,1/3) * Math.pow(Math.PI,2/3);

	var orbits = {};

	for (var set in data0) {
		orbits[set] = [];
		for (var i in data0[set]) {
			var o = data0[set][i];
			var nomad = o[0]; // NOMAD identification number
			var incl = o[1]; // inclination (degrees)
			var raan = o[2]; // right ascension of the ascending node (degress)
			var ecc = o[3]; // eccentricity
			var argp = o[4]; // argument of periapsis (degrees)
			var M0 = o[5]; // mean anomaly at epoch (pseudo degrees)
			var mm = o[6]; // mean motion; revolutions per days

			var a = dm / (k * Math.pow(mm,2/3)); // semi-major axis in meters
			var b = a * Math.sqrt(1 - ecc*ecc); // semi-minor axis

			var ref = [1,0,0];
			var up = [0,1,0];
			var ascn = v3rotate(ref, up, raan);
			var basis_x = v3rotate(v3rotate(ref, up, raan + argp), ascn, incl);
			var orbital_plane_normal = v3normalize(v3cross(basis_x, ascn));
			var basis_y = v3cross(basis_x, orbital_plane_normal);

			orbits[set].push({
				"id": nomad,
				"M0": M0,
				"mm": mm,
				"e": ecc,
				"a": a,
				"b": b,
				"x": basis_x,
				"y": basis_y,
			});
		}
	}

	this.get_sets = function () {
		return orbits;
	};

	this.calc_ellipse_position = function (orbit, eccentric_anomaly_degrees) {
		var E = deg2rad(eccentric_anomaly_degrees);
		var ex = (Math.cos(E) - orbit.e) * orbit.a;
		var ey = Math.sin(E) * orbit.b;
		var pos = v3add(v3scale(orbit.x, ex), v3scale(orbit.y, ey));
		return pos;
	};

	this.calc_mean_anomaly = function (orbit, eccentric_anomaly_degrees) {
		var E = deg2rad(eccentric_anomaly_degrees);
		return rad2deg(E - orbit.e * Math.sin(E));
	};

	this.get_time = function () {
		return Date.now() - epoch;
	};
};

function EarthRenderer(image) {
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.bindTexture(gl.TEXTURE_2D, null);

	var shader = new Shader("earth", [["a_position",3], ["a_uv",2]]);

	var buffers = (function () {
		var radius = 6378.1; // km

		var vdata = [];

		var nx = 64;
		var ny = 48;

		for (var y = 0; y < ny; y++) {
			for (var x = 0; x <= nx; x++) {
				var yrad = ((y/ny)*2-1)*Math.PI;
				var xrad = ((x%nx)/nx)*Math.PI*2;

				// xyz
				vdata.push(Math.cos(xrad) * radius * Math.cos(yrad));
				vdata.push(Math.sin(yrad) * radius);
				vdata.push(Math.sin(xrad) * radius * Math.cos(yrad));

				// uv
				vdata.push(1-x/nx);
				vdata.push((1-(y/ny))*3-2.0); // XXX why?
			}
		}

		var idata = []
		for (var y = 0; y < (ny-1); y++) {
			for (var x = 0; x < nx; x++) {
				var x1 = x+1;
				var y1 = y+1;
				var stride = nx+1;
				idata.push(y*stride + x);
				idata.push(y1*stride + x);
				idata.push(y1*stride + x1);
				idata.push(y*stride + x);
				idata.push(y1*stride + x1);
				idata.push(y*stride + x1);
			}
		}

		var vb = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vb);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vdata), gl.STATIC_DRAW);

		var ib = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idata), gl.STATIC_DRAW);

		return {
			"vb": vb,
			"ib": ib,
			"count": idata.length
		};

	})();

	//console.log(buffers);

	this.draw = function (projection, view, time) {
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);
		gl.enable(gl.CULL_FACE);
		shader.enable();

		view = m4mul(view, m4rotation([0,1,0], time / (1000*24*60*60)));

		gl.bindTexture(gl.TEXTURE_2D, texture);

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vb);
		shader.setup_vertex_attrib_pointers();
		shader.set_uniform_matrix("u_projection", projection);
		shader.set_uniform_matrix("u_view", view);
		shader.set_uniform_int("u_texture", 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.ib);
		gl.drawElements(gl.TRIANGLES, buffers.count, gl.UNSIGNED_SHORT, 0);
		shader.disable();

		gl.bindTexture(gl.TEXTURE_2D, null);
	};
};

function OrbitRenderer(orbits) {
	var shader = new Shader("orbit", [["a_position",3], ["a_M",1], ["a_mm",1]]);

	var buffers = {};

	var N = 128;
	var sets = orbits.get_sets();
	for (var k in sets) {
		var set = sets[k];
		var vdata = [];
		var count = 0;
		for (var si in set) {
			var orb = set[si];
			for (var i = 0; i <= N; i++) {
				var p = orbits.calc_ellipse_position(orb, (i%N)/N*360);
				var M = orbits.calc_mean_anomaly(orb, (i/N)*360) - orb.M0 + 360;
				for (var d = 0; d < ((i==0 || i==N) ? 1 : 2); d++) {
					for (var j = 0; j < 3; j++) vdata.push(p[j]/1000);
					vdata.push(M);
					vdata.push(orb.mm);
					count++;
				}
			}
		}

		var vb = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vb);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vdata), gl.STATIC_DRAW);
		buffers[k] = {"vb": vb, "count": count};
	}
	this.draw = function (projection, view, time) {
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.disable(gl.CULL_FACE);
		gl.lineWidth(2);
		shader.enable();
		for (var k in buffers) {
			var b = buffers[k];
			gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
			shader.setup_vertex_attrib_pointers();
			shader.set_uniform_matrix("u_projection", projection);
			shader.set_uniform_matrix("u_view", view);
			shader.set_uniform_float("u_time", time);
			gl.drawArrays(gl.LINES, 0, b.count);
		};
		shader.disable();
	};
};

function Engine(screen, earth_texture, orbits) {
	var earth = new EarthRenderer(earth_texture);
	var orbit = new OrbitRenderer(orbits);

	gl.enable(gl.BLEND);
	gl.clearColor(0.02,0,0,0);

	this.draw = function (distance) {
		var w = screen.offsetWidth;
		var h = screen.offsetHeight;
		screen.width = w;
		screen.height = h;
		gl.viewport(0, 0, w, h);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		var time = orbits.get_time() * 100;

		var projection = m4perspective(65,w/h,5,400000);
		var view = m4identity();
		view = m4mul(view, m4translation([0,0,-distance]));
		view = m4mul(view, m4rotation([1,0,0], 10));
		var phi = Date.now()/1000;
		view = m4mul(view, m4rotation([0,1,0], phi));

		earth.draw(projection, view, time);
		orbit.draw(projection, view, time);
	};
};

window.onload = function () {
	var screen = document.getElementById('screen');
	gl = screen.getContext('webgl');
	if (!gl) gl = screen.getContext('experimental-webgl');
	if (!gl) panic("Your browser does not support WebGL");

	var request_animation_frame = (function () {
		return window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			function (cb) {
				window.setTimeout(cb, 1000/60);
			};
	})();

	var distance = 15000;

	var earth_texture = new Image();
	earth_texture.onload = function () {
		var orbits = new Orbits(data0);
		data0 = null;
		var engine = new Engine(screen, earth_texture, orbits);

		(function loop() {
			engine.draw(distance);
			request_animation_frame(loop);
		})();
	}
	earth_texture.src = "earth.png";

	window.onmousewheel = function (e) {
		distance *= (1 - e.wheelDelta * 0.0001);
		if (distance < 10000) distance = 10000;
		if (distance > 200000) distance = 200000;
	};
}

