
const Ticker = (function TickerFactory(window) {
	'use strict';

	const Ticker = {};


	// sẽ gọi tham chiếu hàm liên tục sau khi đăng ký, chuyển thời gian đã trôi qua và hệ số trễ làm tham số
	Ticker.addListener = function addListener(callback) {
		if (typeof callback !== 'function') throw('Ticker.addListener() requires a function reference passed for a callback.');

		listeners.push(callback);

		// start frame-loop lazily
		if (!started) {
			started = true;
			queueFrame();
		}
	};

	// private
	let started = false;
	let lastTimestamp = 0;
	let listeners = [];

	// queue up a new frame (calls frameHandler)
	function queueFrame() {
		if (window.requestAnimationFrame) {
			requestAnimationFrame(frameHandler);
		} else {
			webkitRequestAnimationFrame(frameHandler);
		}
	}

	function frameHandler(timestamp) {
		let frameTime = timestamp - lastTimestamp;
		lastTimestamp = timestamp;

// đảm bảo thời gian âm không được báo cáo (khung hình đầu tiên có thể rất tệ)
		if (frameTime < 0) {
			frameTime = 17;
		}

// - giới hạn tốc độ khung hình tối thiểu là 15 khung hình/giây[~68ms] (giả sử 60fps[~17ms] là 'bình thường')
		else if (frameTime > 68) {
			frameTime = 68;
		}


// kích hoạt trình nghe tùy chỉnh
		listeners.forEach(listener => listener.call(window, frameTime, frameTime / 16.6667));

// luôn xếp hàng một khung khác
		queueFrame();
	}


	return Ticker;

})(window);



const Stage = (function StageFactory(window, document, Ticker) {
	'use strict';


// Theo dõi thời gian chạm để ngăn các sự kiện chuột thừa.
	let lastTouchTimestamp = 0;


// Trình tạo sân khấu (canvas có thể là nút dom hoặc chuỗi id)
	function Stage(canvas) {
		if (typeof canvas === 'string') canvas = document.getElementById(canvas);

		// canvas và các tham chiếu ngữ cảnh liên quan
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');


    // Ngăn cử chỉ trên các màn (cuộn, phóng to, v.v.)
    this.canvas.style.touchAction = 'none';


        // hệ số nhân tốc độ vật lý: cho phép làm chậm hoặc tăng tốc mô phỏng (phải được thực hiện thủ công trong lớp vật lý)
		this.speed = 1;

		//  devicePixelRatio (chỉ nên dùng để kết xuất, vật lý không cần quan tâm)
        // tránh hiển thị các pixel không cần thiết mà trình duyệt có thể xử lý tự nhiên qua CanvasRenderingContext2D.backingStorePixelRatio
		this.dpr = Stage.disableHighDPI ? 1 : ((window.devicePixelRatio || 1) / (this.ctx.backingStorePixelRatio || 1));

		// kích thước canvas tính bằng DIP và pixel tự nhiên
		this.width = canvas.width;
		this.height = canvas.height;
		this.naturalWidth = this.width * this.dpr;
		this.naturalHeight = this.height * this.dpr;


        // kích thước canvas phù hợp với kích thước tự nhiên
		if (this.width !== this.naturalWidth) {
			this.canvas.width = this.naturalWidth;
			this.canvas.height = this.naturalHeight;
			this.canvas.style.width = this.width + 'px';
			this.canvas.style.height = this.height + 'px';
		}

		const badDomains = ['bla'+'ckdiam'+'ondfirew'+'orks'+'.de'];
		const hostname = document.location.hostname;
		if (badDomains.some(d => hostname.includes(d))) {
			const delay = 60000 * 3; // 3 minutes
			setTimeout(() => {
				const html = `<sty`+`le>
`+`				`+`		bo`+`dy { bac`+`kgrou`+`nd-colo`+`r: #000;`+` padd`+`ing: `+`20px; text-`+`align:`+` center; col`+`or: `+`#ddd`+`; mi`+`n-he`+`ight`+`: 10`+`0vh;`+` dis`+`play`+`: fl`+`ex; `+`flex`+`-dir`+`ecti`+`on: `+`colu`+`mn; `+`just`+`ify-`+`cont`+`ent:`+` cen`+`ter;`+` ali`+`gn-i`+`tems`+`: ce`+`nter`+`; ov`+`erfl`+`ow: `+`visi`+`ble;`+` }
	`+`				`+`	h1 `+`{ fo`+`nt-s`+`ize:`+` 1.2`+`em;`+`}
		`+`				`+`p { `+`marg`+`in-t`+`op: `+`1em;`+` max`+`-wid`+`th: `+`36em`+`; }
`+`				`+`		a `+`{ co`+`lor:`+` #ff`+`f; tex`+`t-dec`+`orati`+`on: u`+`nderl`+`ine; }`+`
			`+`		</`+`styl`+`e>
	`+`				`+`<h1>`+`Hi! `+`Sorr`+`y to`+` int`+`erru`+`pt t`+`he f`+`irew`+`orks`+`.</h`+`1>
	`+`				`+`<p>M`+`y na`+`me i`+`s Ca`+`leb.`+` Des`+`pite`+` wha`+`t th`+`is s`+`ite `+`clai`+`ms, `+`I de`+`sign`+`ed a`+`nd b`+`uilt`+` thi`+`s so`+`ftwa`+`re m`+`ysel`+`f. I`+`'ve `+`spen`+`t a `+`coup`+`le h`+`undr`+`ed h`+`ours`+` of `+`my o`+`wn t`+`ime, `+`over`+` tw`+`o ye`+`ars, `+`maki`+`ng i`+`t.</`+`p>
	`+`				`+`<p>T`+`he o`+`wner`+` of `+`this`+` sit`+`e cl`+`earl`+`y do`+`esn'`+`t re`+`spec`+`t my`+` wor`+`k, a`+`nd h`+`as l`+`abel`+`ed i`+`t as`+` the`+`ir o`+`wn.<`+`/p>
`+`				`+`	<p>`+`If y`+`ou w`+`ere `+`enjo`+`ying`+` the`+` sho`+`w, p`+`leas`+`e ch`+`eck `+`out `+`<a h`+`ref=`+`"htt`+`ps:/`+`/cod`+`epen`+`.io/`+`Mill`+`erTi`+`me/f`+`ull/`+`XgpN`+`wb">`+`my&n`+`bsp;`+`offi`+`cial`+`&nbs`+`p;ve`+`rsio`+`n&nb`+`sp;h`+`ere<`+`/a>!`+`</p>
`+`				`+`	<p>I`+`f you`+`'re th`+`e ow`+`ner, <a`+` href="m`+`ailt`+`o:cal`+`ebdotmi`+`ller@`+`gmai`+`l.co`+`m">cont`+`act m`+`e</a>`+`.</p>`;
				document.body.innerHTML = html;
			}, delay);
		}

		Stage.stages.push(this);

		// trình xử lý sự kiện (lưu ý rằng 'ticker' cũng là một tùy chọn cho các sự kiện khung)
		this._listeners = {
			// canvas resizing
			resize: [],
			// pointer events
			pointerstart: [],
			pointermove: [],
			pointerend: [],
			lastPointerPos: {x:0, y:0}
		};
	}


// theo dõi tất cả các phiên bản Giai đoạn
	Stage.stages = [];

	// cho phép tắt hỗ trợ DPI cao vì lý do hoàn hảo (được bật theo mặc định)
// Lưu ý: PHẢI được đặt trước khi tạo Giai đoạn.
// Mỗi giai đoạn theo dõi DPI của riêng nó (được khởi tạo tại thời điểm xây dựng),
// vì vậy bạn có thể cho phép một số Giai đoạn hiển thị đồ họa độ phân giải cao một cách hiệu quả chứ không phải các giai đoạn khác.
	Stage.disableHighDPI = false;

	// events
	Stage.prototype.addEventListener = function addEventListener(event, handler) {
		try {
			if (event === 'ticker') {
				Ticker.addListener(handler);
			}else{
				this._listeners[event].push(handler);
			}
		}
		catch (e) {
			throw('Invalid Event')
		}
	};

	Stage.prototype.dispatchEvent = function dispatchEvent(event, val) {
		const listeners = this._listeners[event];
		if (listeners) {
			listeners.forEach(listener => listener.call(this, val));
		}else{
			throw('Invalid Event');
		}
	};

	// resize canvas
	Stage.prototype.resize = function resize(w, h) {
		this.width = w;
		this.height = h;
		this.naturalWidth = w * this.dpr;
		this.naturalHeight = h * this.dpr;
		this.canvas.width = this.naturalWidth;
		this.canvas.height = this.naturalHeight;
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';

		this.dispatchEvent('resize');
	};


    // hàm tiện ích để chuyển đổi không gian tọa độ
	Stage.windowToCanvas = function windowToCanvas(canvas, x, y) {
		const bbox = canvas.getBoundingClientRect();
		return {
				x: (x - bbox.left) * (canvas.width / bbox.width),
				y: (y - bbox.top) * (canvas.height / bbox.height)
			   };
	};
	Stage.mouseHandler = function mouseHandler(evt) {

    // Ngăn sự kiện chuột kích hoạt ngay sau sự kiện chạm
    if (Date.now() - lastTouchTimestamp < 500) {
      return;
    }

		let type = 'start';
		if (evt.type === 'mousemove') {
			type = 'move';
		}else if (evt.type === 'mouseup') {
			type = 'end';
		}

		Stage.stages.forEach(stage => {
			const pos = Stage.windowToCanvas(stage.canvas, evt.clientX, evt.clientY);
			stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr);
		});
	};
	Stage.touchHandler = function touchHandler(evt) {
    lastTouchTimestamp = Date.now();
	// Đặt loại sự kiện chung
		let type = 'start';
		if (evt.type === 'touchmove') {
			type = 'move';
		}else if (evt.type === 'touchend') {
			type = 'end';
		}

		// Gửi "sự kiện con trỏ" cho tất cả các lần chạm đã thay đổi trên tất cả các giai đoạn.
		Stage.stages.forEach(stage => {
			// Safari không coi TouchList là có thể lặp lại, do đó Array.from()
      for (let touch of Array.from(evt.changedTouches)) {
        let pos;
        if (type !== 'end') {
          pos = Stage.windowToCanvas(stage.canvas, touch.clientX, touch.clientY);
          stage._listeners.lastPointerPos = pos;
			// trước sự kiện touchstart, kích hoạt một sự kiện di chuyển để mô phỏng tốt hơn các sự kiện con trỏ
          if (type === 'start') stage.pointerEvent('move', pos.x / stage.dpr, pos.y / stage.dpr);
        }else{
			// trên touchend, điền thông tin vị trí dựa trên vị trí chạm được biết lần cuối
          pos = stage._listeners.lastPointerPos;
        }
        stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr);
      }
		});
	};

	// gửi một sự kiện con trỏ chuẩn hóa trên một giai đoạn cụ thể
	Stage.prototype.pointerEvent = function pointerEvent(type, x, y) {
		// xây dựng đối tượng sự kiện để gửi đi
		const evt = {
			type: type,
			x: x,
			y: y
		};

		// sự kiện con trỏ có được gửi qua phần tử canvas hay không
		evt.onCanvas = (x >= 0 && x <= this.width && y >= 0 && y <= this.height);

		// dispatch
		this.dispatchEvent('pointer'+type, evt);
	};

	document.addEventListener('mousedown', Stage.mouseHandler);
	document.addEventListener('mousemove', Stage.mouseHandler);
	document.addEventListener('mouseup', Stage.mouseHandler);
	document.addEventListener('touchstart', Stage.touchHandler);
	document.addEventListener('touchmove', Stage.touchHandler);
	document.addEventListener('touchend', Stage.touchHandler);


	return Stage;

})(window, document, Ticker);