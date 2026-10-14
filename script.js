// What happens here:
// 1. The moon in the hero is a live Sentinel-2 map that flies between places from my research.
// 2. The bezel around it gets its tick marks, and the sky drifts a little as you scroll.
// 3. The "Why more than three colors" chart is interactive.
// 4. The top bar gets a background after the hero, and the nav highlights the section you're in.

(function () {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------------------------------------------------- top bar + nav */
    var bar = document.querySelector('.bar');
    function onScroll() {
        bar.classList.toggle('solid', window.scrollY > window.innerHeight * 0.62);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var links = document.querySelectorAll('.bar nav a');
    var linkFor = {};
    links.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
    if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                links.forEach(function (a) { a.classList.remove('on'); });
                if (linkFor[e.target.id]) linkFor[e.target.id].classList.add('on');
            });
        }, { rootMargin: '-40% 0px -55% 0px' });
        Object.keys(linkFor).forEach(function (id) {
            var s = document.getElementById(id);
            if (s) spy.observe(s);
        });
        var hero = document.querySelector('.hero');
        new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) links.forEach(function (a) { a.classList.remove('on'); });
        }, { rootMargin: '-40% 0px -55% 0px' }).observe(hero);
    }

    /* ------------------------------------------------------ bezel + sky drift */
    var ticks = document.getElementById('ticks');
    if (ticks) {
        var NS0 = 'http://www.w3.org/2000/svg';
        for (var a = 0; a < 360; a += 3) {
            var major = a % 15 === 0;
            var r0 = major ? 478 : 484, r1 = 494, rad = (a - 90) * Math.PI / 180;
            var ln = document.createElementNS(NS0, 'line');
            ln.setAttribute('x1', (Math.cos(rad) * r0).toFixed(1)); ln.setAttribute('y1', (Math.sin(rad) * r0).toFixed(1));
            ln.setAttribute('x2', (Math.cos(rad) * r1).toFixed(1)); ln.setAttribute('y2', (Math.sin(rad) * r1).toFixed(1));
            ln.setAttribute('stroke-width', major ? '2' : '1');
            ticks.appendChild(ln);
        }
    }
    if (reduceMotion) {
        var spin = document.querySelector('#bezel-spin animateTransform');
        if (spin) spin.remove();
    } else {
        var heroEl = document.querySelector('.hero');
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                var y = Math.min(window.scrollY, window.innerHeight);
                heroEl.style.setProperty('--s', y);
            });
        }, { passive: true });
    }

    /* ------------------------------------------------------------- hero map */
    var STOPS = [
        { name: 'San Francisco Bay Area',
          note: 'Home, and where PG&E, Tesla, Orbital Sidekick and Intersect Power put me to work.',
          center: [-122.15, 37.65], zoom: 9.6 },
        { name: 'Gulf of Alaska',
          note: 'Three Argo floats plus satellite chlorophyll: when do phytoplankton blooms start? My MBARI summer.',
          center: [-146.5, 58.6], zoom: 5.2 },
        { name: 'Corn Belt, Iowa',
          note: 'Cover crops and conservation tillage: what they do to yields across the U.S. Stanford research.',
          center: [-93.6, 42.0], zoom: 8.6 },
        { name: 'White Sea and Barents coast',
          note: 'Where sea surface temperature extremes are changing fastest. My UC Santa Cruz thesis.',
          center: [38.5, 66.5], zoom: 5.4 }
    ];
    var FREE = {
        name: 'Free look',
        note: 'Drag to move around. Hold ctrl and scroll, or pinch with two fingers, to zoom.'
    };

    var placeEl = document.getElementById('hud-place');
    var noteEl = document.getElementById('hud-note');
    var coordsEl = document.getElementById('hud-coords');
    var toggleEl = document.getElementById('tour-toggle');

    function fmt(lat, lon) {
        return Math.abs(lat).toFixed(4) + ' ' + (lat >= 0 ? 'N' : 'S') + ', ' +
               Math.abs(lon).toFixed(4) + ' ' + (lon >= 0 ? 'E' : 'W');
    }
    function showInfo(s) { placeEl.textContent = s.name; noteEl.textContent = s.note; }

    function initMap() {
        if (typeof maplibregl === 'undefined') return;

        var map;
        try {
            map = new maplibregl.Map({
                container: 'map',
                style: {
                    version: 8,
                    sources: {
                        s2: {
                            type: 'raster',
                            tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
                            tileSize: 256,
                            maxzoom: 13,
                            attribution: 'Sentinel-2 cloudless by <a href="https://s2maps.eu" target="_blank" rel="noopener">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2024)'
                        }
                    },
                    layers: [
                        { id: 'bg', type: 'background', paint: { 'background-color': '#0b1026' } },
                        { id: 's2', type: 'raster', source: 's2' }
                    ]
                },
                center: STOPS[0].center,
                zoom: STOPS[0].zoom,
                attributionControl: false,
                cooperativeGestures: true,
                dragRotate: false,
                pitchWithRotate: false,
                maxPitch: 0,
                minZoom: 2.5
            });
        } catch (err) {
            return; // no WebGL: the dark hero background stays
        }

        map.touchZoomRotate.disableRotation();

        // live coordinates of the map center
        var pending = false;
        function updateCoords() {
            pending = false;
            var c = map.getCenter();
            coordsEl.textContent = fmt(c.lat, c.lng);
        }
        map.on('move', function () {
            if (!pending) { pending = true; requestAnimationFrame(updateCoords); }
        });
        updateCoords();

        // the tour
        var idx = 0;
        var timer = null;
        var wantTour = !reduceMotion;   // what the person chose
        var heroVisible = true;

        function fly(i) {
            idx = i;
            showInfo(STOPS[i]);
            map.flyTo({ center: STOPS[i].center, zoom: STOPS[i].zoom, duration: 9000, curve: 1.5, essential: true });
        }
        function schedule() {
            clearInterval(timer);
            if (wantTour && heroVisible) {
                timer = setInterval(function () { fly((idx + 1) % STOPS.length); }, 14500);
            }
        }
        function setLabel() { toggleEl.textContent = wantTour ? 'Pause tour' : 'Resume tour'; }

        toggleEl.hidden = false;
        setLabel();
        if (wantTour) {
            // give the first view a few seconds before moving on
            timer = setTimeout(function () { fly(1); schedule(); }, 6500);
        } else {
            toggleEl.textContent = 'Start tour';
        }

        toggleEl.addEventListener('click', function () {
            wantTour = !wantTour;
            clearTimeout(timer);
            clearInterval(timer);
            if (wantTour) {
                fly((idx + 1) % STOPS.length);
                schedule();
            } else {
                map.stop();
            }
            setLabel();
        });

        // person takes over: stop touring
        function takeOver(e) {
            if (!e.originalEvent) return;
            if (wantTour) {
                wantTour = false;
                clearTimeout(timer);
                clearInterval(timer);
                setLabel();
            }
            showInfo(FREE);
        }
        map.on('dragstart', takeOver);
        map.on('zoomstart', takeOver);

        // don't burn GPU while the hero is off screen
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                heroVisible = entries[0].isIntersecting;
                if (!heroVisible) { clearTimeout(timer); clearInterval(timer); }
                else if (wantTour) { schedule(); }
            }, { threshold: 0.15 }).observe(document.querySelector('.hero'));
        }
    }
    initMap();

    /* ----------------------------------------------------------- spectra chart */
    var BANDS = [
        { n: 'B1',  w: 443,  bw: 20,  label: 'coastal aerosol' },
        { n: 'B2',  w: 490,  bw: 65,  label: 'blue' },
        { n: 'B3',  w: 560,  bw: 35,  label: 'green' },
        { n: 'B4',  w: 665,  bw: 30,  label: 'red' },
        { n: 'B5',  w: 705,  bw: 15,  label: 'red edge 1' },
        { n: 'B6',  w: 740,  bw: 15,  label: 'red edge 2' },
        { n: 'B7',  w: 783,  bw: 20,  label: 'red edge 3' },
        { n: 'B8',  w: 842,  bw: 115, label: 'near-infrared' },
        { n: 'B8A', w: 865,  bw: 20,  label: 'narrow near-infrared' },
        { n: 'B9',  w: 945,  bw: 20,  label: 'water vapor' },
        { n: 'B11', w: 1610, bw: 90,  label: 'shortwave infrared 1' },
        { n: 'B12', w: 2190, bw: 180, label: 'shortwave infrared 2' }
    ];
    // Typical shapes for illustration, not measurements. B10 (cirrus) is skipped because it never sees the surface.
    var SURFACES = [
        { id: 'veg',   name: 'Vegetation', color: 'var(--apple)', hex: '#8fd16a',
          r: [0.04, 0.05, 0.10, 0.05, 0.14, 0.38, 0.46, 0.49, 0.50, 0.48, 0.26, 0.12] },
        { id: 'water', name: 'Water',      color: 'var(--sky)',  hex: '#6db6ff',
          r: [0.06, 0.06, 0.05, 0.03, 0.02, 0.01, 0.01, 0.008, 0.008, 0.004, 0.002, 0.001] },
        { id: 'soil',  name: 'Bare soil',  color: 'var(--ochre)', hex: '#e0a456',
          r: [0.10, 0.12, 0.16, 0.21, 0.24, 0.27, 0.29, 0.31, 0.32, 0.33, 0.42, 0.40] }
    ];
    var iB4 = 3, iB8 = 7;

    function initChart() {
        var svg = document.getElementById('chart-svg');
        var legend = document.getElementById('chart-legend');
        var readout = document.getElementById('chart-readout');
        if (!svg) return;

        var NS = 'http://www.w3.org/2000/svg';
        var YMAX = 0.55;
        var L0 = Math.log10(400), L1 = Math.log10(2300);
        var on = { veg: true, water: true, soil: true };
        var current = iB8;
        var builtAt = 0;
        var api = {};   // functions that depend on the current size

        function el(tag, attrs, parent) {
            var e = document.createElementNS(NS, tag);
            for (var k in attrs) e.setAttribute(k, attrs[k]);
            (parent || svg).appendChild(e);
            return e;
        }

        // smooth curve through the band values (monotone cubic, so it never overshoots)
        function smooth(pts) {
            var n = pts.length, dx = [], m = [], t = [], i;
            for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
            t[0] = m[0]; t[n - 1] = m[n - 2];
            for (i = 1; i < n - 1; i++) t[i] = (m[i - 1] * m[i] <= 0) ? 0 : (m[i - 1] + m[i]) / 2;
            for (i = 0; i < n - 1; i++) {
                if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
                var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
                if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
            }
            var d = 'M' + pts[0][0] + ',' + pts[0][1];
            for (i = 0; i < n - 1; i++) {
                var h = dx[i] / 3;
                d += ' C' + (pts[i][0] + h) + ',' + (pts[i][1] + t[i] * h) +
                     ' ' + (pts[i + 1][0] - h) + ',' + (pts[i + 1][1] - t[i + 1] * h) +
                     ' ' + pts[i + 1][0] + ',' + pts[i + 1][1];
            }
            return d;
        }

        function build() {
            svg.innerHTML = '';
            legend.innerHTML = '';

            var W = Math.max(300, Math.min(720, Math.round(svg.getBoundingClientRect().width) || 720));
            var narrow = W < 480;
            var H = narrow ? 320 : 380;
            builtAt = W;
            svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

            var M = { l: 42, r: 12, t: 24, b: 56 };
            var pw = W - M.l - M.r, ph = H - M.t - M.b;
            function X(nm) { return M.l + (Math.log10(nm) - L0) / (L1 - L0) * pw; }
            function Y(r)  { return M.t + ph - (r / YMAX) * ph; }

            // visible spectrum strip under the axis
            var defs = el('defs', {});
            var grad = el('linearGradient', { id: 'vis', x1: X(400), x2: X(700), y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs);
            [[400, '#7a28ff'], [450, '#2f5bff'], [490, '#19c8d8'], [550, '#4ee05a'], [590, '#f2e43a'], [630, '#ff8a1f'], [700, '#d6171c']]
                .forEach(function (s) {
                    el('stop', { offset: ((X(s[0]) - X(400)) / (X(700) - X(400))), 'stop-color': s[1] }, grad);
                });

            // grid + y axis
            [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(function (v) {
                el('line', { class: v === 0 ? 'axis' : 'grid', x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v) });
                var t = el('text', { x: M.l - 8, y: Y(v) + 4, 'text-anchor': 'end' });
                t.textContent = v.toFixed(1);
            });
            var yl = el('text', { x: 10, y: M.t + ph / 2, 'text-anchor': 'middle', transform: 'rotate(-90 10 ' + (M.t + ph / 2) + ')' });
            yl.textContent = 'Reflectance';

            // x axis
            (narrow ? [500, 1000, 2000] : [500, 700, 1000, 1500, 2000]).forEach(function (nm) {
                el('line', { class: 'grid', x1: X(nm), x2: X(nm), y1: M.t, y2: M.t + ph });
                var t = el('text', { x: X(nm), y: M.t + ph + 34, 'text-anchor': 'middle' });
                t.textContent = nm;
            });
            var xl = el('text', { x: W - M.r, y: H - 6, 'text-anchor': 'end' });
            xl.textContent = 'Wavelength (nm)';
            el('rect', { x: X(400), y: M.t + ph + 6, width: X(700) - X(400), height: 7, fill: 'url(#vis)', opacity: 0.9 });
            if (!narrow) {
                var vl = el('text', { x: X(400), y: H - 6 });
                vl.textContent = 'What your eyes see';
            }

            // Sentinel-2 bands
            var bandEls = BANDS.map(function (b) {
                var x0 = X(b.w - b.bw / 2), x1 = X(b.w + b.bw / 2);
                return el('rect', { class: 'band', x: x0, y: M.t, width: Math.max(x1 - x0, 3), height: ph });
            });
            (narrow ? [3, 7, 11] : [0, 1, 3, 7, 10, 11]).forEach(function (i) {
                var t = el('text', { x: X(BANDS[i].w), y: M.t - 9, 'text-anchor': 'middle' });
                t.textContent = BANDS[i].n;
            });

            // curves and dots
            var curveEls = {}, dotEls = {};
            SURFACES.forEach(function (s) {
                var pts = BANDS.map(function (b, i) { return [X(b.w), Y(s.r[i])]; });
                curveEls[s.id] = el('path', { class: 'curve', d: smooth(pts), stroke: s.hex });
                dotEls[s.id] = el('circle', { r: 5, fill: s.hex, stroke: '#121a3c', 'stroke-width': 2 });
                if (!on[s.id]) curveEls[s.id].style.display = 'none';
            });

            // legend chips with live NDVI
            SURFACES.forEach(function (s) {
                var ndvi = (s.r[iB8] - s.r[iB4]) / (s.r[iB8] + s.r[iB4]);
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'chip';
                b.setAttribute('aria-pressed', on[s.id] ? 'true' : 'false');
                b.style.setProperty('--c', s.hex);
                b.innerHTML = '<i></i>' + s.name + ' <small>NDVI ' + ndvi.toFixed(2) + '</small>';
                b.addEventListener('click', function () {
                    on[s.id] = !on[s.id];
                    b.setAttribute('aria-pressed', on[s.id] ? 'true' : 'false');
                    curveEls[s.id].style.display = on[s.id] ? '' : 'none';
                    api.select(current);
                });
                legend.appendChild(b);
            });

            api.select = function (i) {
                current = i;
                bandEls.forEach(function (r, k) { r.setAttribute('class', 'band' + (k === i ? ' hot' : '')); });
                var b = BANDS[i], parts = [];
                SURFACES.forEach(function (s) {
                    dotEls[s.id].setAttribute('cx', X(b.w));
                    dotEls[s.id].setAttribute('cy', Y(s.r[i]));
                    dotEls[s.id].style.display = on[s.id] ? '' : 'none';
                    if (on[s.id]) parts.push(s.name + ' ' + s.r[i].toFixed(2));
                });
                readout.innerHTML = '<b>' + b.n + ', ' + b.label + '</b> at ' + b.w + ' nm<br>' +
                    (parts.join('   ') || 'Turn a surface back on to compare.');
            };
            api.nearest = function (clientX) {
                var rect = svg.getBoundingClientRect();
                var x = (clientX - rect.left) / rect.width * W;
                var best = 0, bd = 1e9;
                BANDS.forEach(function (b, i) {
                    var d = Math.abs(X(b.w) - x);
                    if (d < bd) { bd = d; best = i; }
                });
                return best;
            };
            api.select(current);
        }

        svg.addEventListener('pointermove', function (ev) { api.select(api.nearest(ev.clientX)); });
        svg.addEventListener('pointerdown', function (ev) { api.select(api.nearest(ev.clientX)); });
        svg.setAttribute('tabindex', '0');
        svg.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') { api.select(Math.min(current + 1, BANDS.length - 1)); e.preventDefault(); }
            if (e.key === 'ArrowLeft')  { api.select(Math.max(current - 1, 0)); e.preventDefault(); }
        });

        build();
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                var w = Math.round(svg.getBoundingClientRect().width);
                if (Math.abs(w - builtAt) > 24) build();
            }, 150);
        });
    }
    initChart();

    /* ---------------------------------------------------- shared little signal model
       A made-up solar output curve (clipped sine, period 40 steps) plus noise.
       The "model" expects the clean curve. A point is flagged when it is further than k sigma away. */
    var PERIOD = 40, SIGMA = 0.05;
    function expectedAt(t) { return Math.max(0, -Math.cos(2 * Math.PI * (t % PERIOD) / PERIOD)); }
    function rng(seed) {
        var a = seed >>> 0;
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function gauss(r) {
        var u = 0, v = 0;
        while (u === 0) u = r();
        v = r();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    /* ------------------------------------------------------ hero: little live signal */
    function initOrb() {
        var cv = document.getElementById('orb-canvas');
        if (!cv || !cv.getContext) return;
        var ctx = cv.getContext('2d');
        var N = 70, buf = [], t = 0, r = rng(7), event = 0, nextEvent = 55, visible = true, timer = null;
        var w = 0, h = 0, dpr = 1;
        function size() {
            var b = cv.getBoundingClientRect();
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = Math.max(1, Math.round(b.width)); h = Math.max(1, Math.round(b.height));
            cv.width = w * dpr; cv.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        function step() {
            var e = expectedAt(t);
            var v = e + gauss(r) * SIGMA;
            if (t >= nextEvent && e > 0.55 && event === 0) { event = 7; nextEvent = t + 70 + Math.floor(r() * 60); }
            if (event > 0) { v = e * 0.4 + gauss(r) * SIGMA; event--; }
            buf.push({ v: v, e: e, f: Math.abs(v - e) > 2.6 * SIGMA });
            if (buf.length > N) buf.shift();
            t++;
        }
        function draw() {
            ctx.clearRect(0, 0, w, h);
            var padY = h * 0.22, hh = h - padY * 2;
            var X = function (i) { return (i / (N - 1)) * w; };
            var Y = function (v) { return h - padY - Math.max(-0.1, Math.min(1.15, v)) * hh * 0.88; };
            // expected band
            ctx.beginPath();
            buf.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](X(i), Y(p.e + 2.6 * SIGMA)); });
            for (var i = buf.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(buf[i].e - 2.6 * SIGMA));
            ctx.closePath(); ctx.fillStyle = 'rgba(255,178,62,0.22)'; ctx.fill();
            // line
            ctx.beginPath();
            buf.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](X(i), Y(p.v)); });
            ctx.strokeStyle = '#eaf2fc'; ctx.lineWidth = Math.max(1.2, w / 110); ctx.lineJoin = 'round'; ctx.stroke();
            // flagged
            buf.forEach(function (p, i) {
                if (!p.f) return;
                ctx.beginPath(); ctx.arc(X(i), Y(p.v), Math.max(2.2, w / 55), 0, 6.283);
                ctx.fillStyle = '#ffb23e'; ctx.fill();
                ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b1026'; ctx.stroke();
            });
        }
        size();
        for (var k = 0; k < N; k++) step();
        draw();
        window.addEventListener('resize', function () { size(); draw(); });
        if (reduceMotion) return;
        function tick() { step(); draw(); }
        function start() { if (!timer) timer = setInterval(tick, 110); }
        function stop() { clearInterval(timer); timer = null; }
        start();
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 }).observe(document.querySelector('.hero'));
        }
        document.addEventListener('visibilitychange', function () { document.hidden ? stop() : (visible && start()); });
    }
    initOrb();

    /* ------------------------------------------------------ signal and noise demo */
    function initSignal() {
        var svg = document.getElementById('sig-svg');
        var slider = document.getElementById('sig-k');
        if (!svg || !slider) return;
        var NS = 'http://www.w3.org/2000/svg';
        var DAYS = 6, N = PERIOD * DAYS;
        var W = 720, H = 300, L = 34, R = 10, T = 12, B = 26;
        var seed = 11, data = [], events = [];
        var out = document.getElementById('sig-readout');
        var kv = document.getElementById('sig-kv');
        var layers = {};

        function X(i) { return L + (i / (N - 1)) * (W - L - R); }
        function Y(v) { return T + (1 - (Math.max(-0.12, Math.min(1.2, v)) + 0.12) / 1.32) * (H - T - B); }
        function el(name, attrs, parent) {
            var n = document.createElementNS(NS, name);
            for (var k in attrs) n.setAttribute(k, attrs[k]);
            if (parent) parent.appendChild(n);
            return n;
        }

        function generate() {
            var r = rng(seed);
            data = []; events = [];
            // four hidden events on four different days: two big outages, two subtle drops (like a bad meter)
            var days = [0, 1, 2, 3, 4, 5].sort(function () { return r() - 0.5; }).slice(0, 4);
            var kinds = [0.3, 0.8, 0.35, 0.82];
            days.forEach(function (d, j) {
                var c = d * PERIOD + PERIOD / 2 + Math.round((r() - 0.5) * 6);
                events.push({ a: c - 4, b: c + 4, f: kinds[j] });
            });
            for (var i = 0; i < N; i++) {
                var e = expectedAt(i), v = e + gauss(r) * SIGMA;
                events.forEach(function (ev) { if (i >= ev.a && i <= ev.b) v = e * ev.f + gauss(r) * SIGMA; });
                data.push({ v: v, e: e });
            }
        }

        function build() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            // grid
            [0, 0.5, 1].forEach(function (g) {
                el('line', { x1: L, x2: W - R, y1: Y(g), y2: Y(g), 'class': 'grid' }, svg);
                var t = el('text', { x: L - 8, y: Y(g) + 4, 'text-anchor': 'end' }, svg); t.textContent = g === 0 ? '0' : g === 1 ? 'max' : 'half';
            });
            for (var d = 0; d < DAYS; d++) {
                var tx = el('text', { x: X(d * PERIOD + PERIOD / 2), y: H - 6, 'text-anchor': 'middle' }, svg);
                tx.textContent = 'Day ' + (d + 1);
            }
            layers.truth = el('g', {}, svg);
            layers.exp = el('path', { 'class': 'exp' }, svg);
            layers.line = el('path', { 'class': 'line' }, svg);
            layers.flags = el('g', {}, svg);
            events.forEach(function (ev) {
                el('rect', { x: X(ev.a), width: X(ev.b) - X(ev.a), y: T, height: H - T - B, 'class': 'truth' }, layers.truth);
            });
            var d1 = 'M' + data.map(function (p, i) { return X(i).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' L');
            layers.line.setAttribute('d', d1);
            update();
        }

        function update() {
            var k = parseFloat(slider.value);
            kv.textContent = k.toFixed(1) + ' sigma';
            var up = 'M' + data.map(function (p, i) { return X(i).toFixed(1) + ',' + Y(p.e + k * SIGMA).toFixed(1); }).join(' L');
            var dn = data.map(function (p, i) { return X(N - 1 - i).toFixed(1) + ',' + Y(data[N - 1 - i].e - k * SIGMA).toFixed(1); }).join(' L');
            layers.exp.setAttribute('d', up + ' L' + dn + ' Z');
            while (layers.flags.firstChild) layers.flags.removeChild(layers.flags.firstChild);
            var flagged = 0, falseAlarms = 0, caught = events.map(function () { return false; });
            data.forEach(function (p, i) {
                if (Math.abs(p.v - p.e) <= k * SIGMA) return;
                flagged++;
                var inEvent = -1;
                events.forEach(function (ev, j) { if (i >= ev.a && i <= ev.b) inEvent = j; });
                if (inEvent >= 0) caught[inEvent] = true; else falseAlarms++;
                el('circle', { cx: X(i), cy: Y(p.v), r: 4, 'class': 'flag' }, layers.flags);
            });
            var got = caught.filter(Boolean).length;
            out.innerHTML = '<b>' + got + ' of ' + events.length + '</b> real events caught, <b>' + falseAlarms + '</b> false alarm' + (falseAlarms === 1 ? '' : 's') +
                (k < 1.8 ? '. Too jumpy: nobody would trust this alarm.' : k > 4.2 ? '. Too quiet: the small drops slip through.' : '.');
        }

        slider.addEventListener('input', update);
        document.getElementById('sig-new').addEventListener('click', function () { seed = (seed * 7 + 13) % 9973; generate(); build(); });
        generate(); build();
    }
    initSignal();
})();
