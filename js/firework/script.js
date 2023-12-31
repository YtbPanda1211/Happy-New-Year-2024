'use strict';
console.clear();
const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;
const IS_HIGH_END_DEVICE = (() => {
    const hwConcurrency = navigator.hardwareConcurrency;
    if (!hwConcurrency) {
        return false;
    }
    // Màn hình lớn biểu thị máy tính có kích thước đầy đủ, ngày nay thường có siêu phân luồng.
    // Vì vậy, một máy tính để bàn lõi tứ có 8 lõi. Chúng tôi sẽ đặt ngưỡng tối thiểu cao hơn ở đó.
    const minCount = window.innerWidth <= 1024 ? 4 : 8;
    return hwConcurrency >= minCount;
})();
// Ngăn không cho canvas trở nên quá lớn trên các kích thước màn hình lố bịch.
// 8K - có thể hạn chế nếu cần
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9;
let simSpeed = 1;

function getDefaultScaleFactor() {
    if (IS_MOBILE) return 0.9;
    if (IS_HEADER) return 0.75;
    return 1;
}

// Các giá trị chiều rộng/chiều cao có tính đến tỷ lệ.
// SỬ DỤNG NÀY ĐỂ VẼ VỊ TRÍ
let stageW, stageH;


// Tất cả các toàn cầu chất lượng sẽ được ghi đè và cập nhật thông qua `configDidUpdate`.
let quality = 1;
let isLowQuality = false;
let isNormalQuality = true;
let isHighQuality = false;

const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;

const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_DIM = 1;
const SKY_LIGHT_NORMAL = 2;

const COLOR = {
    Red: '#ff0043',
    Green: '#14fc56',
    Blue: '#1e7fff',
    Purple: '#e60aff',
    Gold: '#ffbf36',
    White: '#ffffff'
};


// Màu vô hình đặc biệt (không được hiển thị và do đó không có trong bản đồ MÀU)
const INVISIBLE = '_INVISIBLE_';

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

const trailsStage = new Stage('trails-canvas');
const mainStage = new Stage('main-canvas');
const stages = [
    trailsStage,
    mainStage
];


function fullscreenEnabled() {
    return fscreen.fullscreenEnabled;
}


// Lưu ý rằng trạng thái toàn màn hình được đồng bộ hóa với cửa hàng và cửa hàng phải là nguồn
// sự thật về việc ứng dụng có ở chế độ toàn màn hình hay không.
function isFullscreen() {
    return !!fscreen.fullscreenElement;
}


// Cố gắng chuyển sang chế độ toàn màn hình.
function toggleFullscreen() {
    if (fullscreenEnabled()) {
        if (isFullscreen()) {
            fscreen.exitFullscreen();
        } else {
            fscreen.requestFullscreen(document.documentElement);
        }
    }
}

// Đồng bộ các thay đổi toàn màn hình với store. Trình lắng nghe sự kiện là cần thiết vì người dùng có thể
// chuyển đổi chế độ toàn màn hình trực tiếp thông qua trình duyệt và chúng tôi muốn phản ứng với điều đó.
fscreen.addEventListener('fullscreenchange', () => {
    store.setState({fullscreen: isFullscreen()});
});


// Bộ chứa trạng thái đơn giản.
const store = {
    _listeners: new Set(),
    _dispatch(prevState) {
        this._listeners.forEach(listener => listener(this.state, prevState))
    },

    state: {
        // sẽ không bị tạm dừng trong init()
        paused: true,
        soundEnabled: true,
        menuOpen: false,
        openHelpTopic: null,
        fullscreen: isFullscreen(),

        // Lưu ý rằng các giá trị cấu hình được sử dụng cho <select> phải là chuỗi, trừ khi chuyển đổi giá trị thành chuỗi theo cách thủ công
        // tại thời điểm kết xuất và phân tích cú pháp khi thay đổi.
        config: {
            quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL), // sẽ được nhân đôi thành một biến toàn cầu có tên `quality` trong `configDidUpdate`, cho perf.
            shell: 'Random',
            size: IS_DESKTOP
                ? '3' // Desktop default
                : IS_HEADER
                    ? '1.2' // Profile header default
                    : '2', // Mobile default
            autoLaunch: true,
            finale: true,
            skyLighting: SKY_LIGHT_NORMAL + '',
            hideControls: IS_HEADER,
            longExposure: false,
            scaleFactor: getDefaultScaleFactor()
        }
    },

    setState(nextState) {
        const prevState = this.state;
        this.state = Object.assign({}, this.state, nextState);
        this._dispatch(prevState);
        this.persist();
    },

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.remove(listener);
    },


    // Tải/tiếp tục chọn trạng thái vào localStorage
    // Thay đổi trạng thái vì `store.load()` chỉ nên được gọi một lần ngay sau khi cửa hàng được tạo, trước bất kỳ đăng ký nào.
    load() {
        const serializedData = localStorage.getItem('cm_fireworks_data');
        if (serializedData) {
            const {
                schemaVersion,
                data
            } = JSON.parse(serializedData);

            const config = this.state.config;
            switch (schemaVersion) {
                case '1.1':
                    config.quality = data.quality;
                    config.size = data.size;
                    config.skyLighting = data.skyLighting;
                    break;
                case '1.2':
                    config.quality = data.quality;
                    config.size = data.size;
                    config.skyLighting = data.skyLighting;
                    config.scaleFactor = data.scaleFactor;
                    break;
                default:
                    throw new Error('version switch should be exhaustive');
            }
            console.log(`Loaded config (schema version ${schemaVersion})`);
        }
        // Định dạng dữ liệu không dùng nữa. Đã kiểm tra cẩn thận (nó không được đặt tên).
        else if (localStorage.getItem('schemaVersion') === '1') {
            let size;
            // Cố gắng phân tích dữ liệu, bỏ qua nếu có lỗi.
            try {
                const sizeRaw = localStorage.getItem('configSize');
                size = typeof sizeRaw === 'string' && JSON.parse(sizeRaw);
            } catch (e) {
                console.log('Recovered from error parsing saved config:');
                console.error(e);
                return;
            }
            // Chỉ khôi phục các giá trị đã được xác thực
            const sizeInt = parseInt(size, 10);
            if (sizeInt >= 0 && sizeInt <= 4) {
                this.state.config.size = String(sizeInt);
            }
        }
    },

    persist() {
        const config = this.state.config;
        localStorage.setItem('cm_fireworks_data', JSON.stringify({
            schemaVersion: '1.2',
            data: {
                quality: config.quality,
                size: config.size,
                skyLighting: config.skyLighting,
                scaleFactor: config.scaleFactor
            }
        }));
    }
};


if (!IS_HEADER) {
    store.load();
}

// Actions
// ---------

function togglePause(toggle) {
    const paused = store.state.paused;
    let newValue;
    if (typeof toggle === 'boolean') {
        newValue = toggle;
    } else {
        newValue = !paused;
    }

    if (paused !== newValue) {
        store.setState({paused: newValue});
    }
}

function toggleSound(toggle) {
    if (typeof toggle === 'boolean') {
        store.setState({soundEnabled: toggle});
    } else {
        store.setState({soundEnabled: !store.state.soundEnabled});
    }
}

function toggleMenu(toggle) {
    if (typeof toggle === 'boolean') {
        store.setState({menuOpen: toggle});
    } else {
        store.setState({menuOpen: !store.state.menuOpen});
    }
}

function updateConfig(nextConfig) {
    nextConfig = nextConfig || getConfigFromDOM();
    store.setState({
        config: Object.assign({}, store.state.config, nextConfig)
    });

    configDidUpdate();
}

// Ánh xạ cấu hình tới các thuộc tính khác nhau & áp dụng các tác dụng phụ
function configDidUpdate() {
    const config = store.state.config;

    quality = qualitySelector();
    isLowQuality = quality === QUALITY_LOW;
    isNormalQuality = quality === QUALITY_NORMAL;
    isHighQuality = quality === QUALITY_HIGH;

    if (skyLightingSelector() === SKY_LIGHT_NONE) {
        appNodes.canvasContainer.style.backgroundColor = '#000';
    }

    Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}

// Selectors
// -----------

const isRunning = (state = store.state) => !state.paused && !state.menuOpen;
// Người dùng có bật âm thanh hay không.
const soundEnabledSelector = (state = store.state) => state.soundEnabled;
// Có cho phép bất kỳ âm thanh nào hay không, có tính đến nhiều yếu tố.
const canPlaySoundSelector = (state = store.state) => isRunning(state) && soundEnabledSelector(state);
const qualitySelector = () => +store.state.config.quality;
const shellNameSelector = () => store.state.config.shell;
// Chuyển đổi kích thước vỏ thành số.
const shellSizeSelector = () => +store.state.config.size;
const finaleSelector = () => store.state.config.finale;
const skyLightingSelector = () => +store.state.config.skyLighting;
const scaleFactorSelector = () => store.state.config.scaleFactor;


// Help Content
const helpContent = {
    shellType: {
        header: 'loại pháo hoa',
        body: 'Đối với loại pháo hoa bạn muốn bắn, hãy chọn "Ngẫu nhiên" để có trải nghiệm tuyệt vời!'
    },
    shellSize: {
        header: 'kích thước pháo hoa',
        body: 'Pháo hoa càng lớn thì phạm vi nở hoa càng lớn, nhưng pháo hoa càng lớn thì thiết bị càng cần hiệu suất cao. Pháo hoa lớn có thể khiến thiết bị của bạn bị đơ.'
    },
    quality: {
        header: 'chất lượng hình ảnh',
        body: 'Nếu hoạt ảnh không chạy mượt mà, bạn có thể thử giảm chất lượng. Chất lượng càng cao thì càng có nhiều tia lửa sau khi pháo hoa nở, nhưng chất lượng cao có thể khiến thiết bị của bạn bị đơ.'
    },
    skyLighting: {
        header: 'thắp sáng bầu trời',
        body: 'Khi pháo hoa nổ, nền được chiếu sáng. Nếu màn hình của bạn có vẻ quá sáng, hãy thay đổi thành "tối" hoặc "không".'
    },
    scaleFactor: {
        header: 'thu phóng',
        body: 'Đưa bạn đến gần hơn hoặc xa hơn với pháo hoa. Đối với pháo hoa lớn hơn, bạn có thể chọn các giá trị tỷ lệ nhỏ hơn, đặc biệt là trên điện thoại hoặc máy tính bảng.'
    },
    autoLaunch: {
        header: 'bắn pháo hoa tự động',
        body: 'Sau khi bật, bạn có thể ngồi trước màn hình thiết bị của mình và thưởng thức pháo hoa, đồng thời bạn cũng có thể tắt tính năng này, nhưng sau khi tắt, bạn chỉ có thể bắn pháo hoa bằng cách chạm vào màn hình.'
    },
    finaleMode: {
        header: 'đốt nhiều pháo hoa hơn cùng một lúc',
        body: 'Có thể tự động thả nhiều pháo hoa cùng lúc (nhưng bạn cần bật "Pháo hoa tự động" trước）'
    },
    hideControls: {
        header: 'ẩn nút điều khiển',
        body: 'Ẩn các nút ở đầu màn hình. Nếu muốn chụp ảnh màn hình hoặc cần trải nghiệm liền mạch, bạn có thể ẩn nút và vẫn có thể mở cài đặt ở góc trên bên phải sau khi ẩn nút.'
    },
    fullscreen: {
        header: 'toàn màn hình',
        body: 'Chuyển sang chế độ toàn màn hình'
    },
    longExposure: {
        header: 'giữ những tia lửa từ pháo hoa',
        body: 'Có thể bảo quản tia lửa do pháo hoa để lại'
    }
};

const nodeKeyToHelpKey = {
    shellTypeLabel: 'shellType',
    shellSizeLabel: 'shellSize',
    qualityLabel: 'quality',
    skyLightingLabel: 'skyLighting',
    scaleFactorLabel: 'scaleFactor',
    autoLaunchLabel: 'autoLaunch',
    finaleModeLabel: 'finaleMode',
    hideControlsLabel: 'hideControls',
    fullscreenLabel: 'fullscreen',
    longExposureLabel: 'longExposure'
};


// Render app UI / keep in sync with state
const appNodes = {
    stageContainer: '.stage-container',
    canvasContainer: '.canvas-container',
    controls: '.controls',
    menu: '.menu',
    menuInnerWrap: '.menu__inner-wrap',
    pauseBtn: '.pause-btn',
    pauseBtnSVG: '.pause-btn use',
    soundBtn: '.sound-btn',
    soundBtnSVG: '.sound-btn use',
    shellType: '.shell-type',
    shellTypeLabel: '.shell-type-label',
    shellSize: '.shell-size',
    shellSizeLabel: '.shell-size-label',
    quality: '.quality-ui',
    qualityLabel: '.quality-ui-label',
    skyLighting: '.sky-lighting',
    skyLightingLabel: '.sky-lighting-label',
    scaleFactor: '.scaleFactor',
    scaleFactorLabel: '.scaleFactor-label',
    autoLaunch: '.auto-launch',
    autoLaunchLabel: '.auto-launch-label',
    finaleModeFormOption: '.form-option--finale-mode',
    finaleMode: '.finale-mode',
    finaleModeLabel: '.finale-mode-label',
    hideControls: '.hide-controls',
    hideControlsLabel: '.hide-controls-label',
    fullscreenFormOption: '.form-option--fullscreen',
    fullscreen: '.fullscreen',
    fullscreenLabel: '.fullscreen-label',
    longExposure: '.long-exposure',
    longExposureLabel: '.long-exposure-label',

    // Help UI
    helpModal: '.help-modal',
    helpModalOverlay: '.help-modal__overlay',
    helpModalHeader: '.help-modal__header',
    helpModalBody: '.help-modal__body',
    helpModalCloseBtn: '.help-modal__close-btn'
};


// Chuyển bộ chọn appNodes thành nút dom
Object.keys(appNodes).forEach(key => {
    appNodes[key] = document.querySelector(appNodes[key]);
});


// Xóa điều khiển toàn màn hình nếu không được hỗ trợ.
if (!fullscreenEnabled()) {
    appNodes.fullscreenFormOption.classList.add('remove');
}


// Kết xuất đầu tiên được gọi trong init()
function renderApp(state) {
    const pauseBtnIcon = `#icon-${state.paused ? 'play' : 'pause'}`;
    const soundBtnIcon = `#icon-sound-${soundEnabledSelector() ? 'on' : 'off'}`;
    appNodes.pauseBtnSVG.setAttribute('href', pauseBtnIcon);
    appNodes.pauseBtnSVG.setAttribute('xlink:href', pauseBtnIcon);
    appNodes.soundBtnSVG.setAttribute('href', soundBtnIcon);
    appNodes.soundBtnSVG.setAttribute('xlink:href', soundBtnIcon);
    appNodes.controls.classList.toggle('hide', state.menuOpen || state.config.hideControls);
    appNodes.canvasContainer.classList.toggle('blur', state.menuOpen);
    appNodes.menu.classList.toggle('hide', !state.menuOpen);
    appNodes.finaleModeFormOption.style.opacity = state.config.autoLaunch ? 1 : 0.32;

    appNodes.quality.value = state.config.quality;
    appNodes.shellType.value = state.config.shell;
    appNodes.shellSize.value = state.config.size;
    appNodes.autoLaunch.checked = state.config.autoLaunch;
    appNodes.finaleMode.checked = state.config.finale;
    appNodes.skyLighting.value = state.config.skyLighting;
    appNodes.hideControls.checked = state.config.hideControls;
    appNodes.fullscreen.checked = state.fullscreen;
    appNodes.longExposure.checked = state.config.longExposure;
    appNodes.scaleFactor.value = state.config.scaleFactor.toFixed(2);

    appNodes.menuInnerWrap.style.opacity = state.openHelpTopic ? 0.12 : 1;
    appNodes.helpModal.classList.toggle('active', !!state.openHelpTopic);
    if (state.openHelpTopic) {
        const {header, body} = helpContent[state.openHelpTopic];
        appNodes.helpModalHeader.textContent = header;
        appNodes.helpModalBody.textContent = body;
    }
}

store.subscribe(renderApp);


// Thực hiện các tác dụng phụ khi thay đổi trạng thái
function handleStateChange(state, prevState) {
    const canPlaySound = canPlaySoundSelector(state);
    const canPlaySoundPrev = canPlaySoundSelector(prevState);

    if (canPlaySound !== canPlaySoundPrev) {
        if (canPlaySound) {
            soundManager.resumeAll();
        } else {
            soundManager.pauseAll();
        }
    }
}

store.subscribe(handleStateChange);


function getConfigFromDOM() {
    return {
        quality: appNodes.quality.value,
        shell: appNodes.shellType.value,
        size: appNodes.shellSize.value,
        autoLaunch: appNodes.autoLaunch.checked,
        finale: appNodes.finaleMode.checked,
        skyLighting: appNodes.skyLighting.value,
        longExposure: appNodes.longExposure.checked,
        hideControls: appNodes.hideControls.checked,
        // Store value as number.
        scaleFactor: parseFloat(appNodes.scaleFactor.value)
    };
};

const updateConfigNoEvent = () => updateConfig();
appNodes.quality.addEventListener('input', updateConfigNoEvent);
appNodes.shellType.addEventListener('input', updateConfigNoEvent);
appNodes.shellSize.addEventListener('input', updateConfigNoEvent);
appNodes.autoLaunch.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.finaleMode.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.skyLighting.addEventListener('input', updateConfigNoEvent);
appNodes.longExposure.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.hideControls.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.fullscreen.addEventListener('click', () => setTimeout(toggleFullscreen, 0));
// Changing scaleFactor requires triggering resize handling code as well.
appNodes.scaleFactor.addEventListener('input', () => {
    updateConfig();
    handleResize();
});

Object.keys(nodeKeyToHelpKey).forEach(nodeKey => {
    const helpKey = nodeKeyToHelpKey[nodeKey];
    appNodes[nodeKey].addEventListener('click', () => {
        store.setState({openHelpTopic: helpKey});
    });
});

appNodes.helpModalCloseBtn.addEventListener('click', () => {
    store.setState({openHelpTopic: null});
});

appNodes.helpModalOverlay.addEventListener('click', () => {
    store.setState({openHelpTopic: null});
});



// Dẫn xuất hằng số
const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(colorName => COLOR[colorName]);

// Các ngôi sao vô hình cần một bộ định danh, thậm chí chúng sẽ không được hiển thị - vật lý vẫn được áp dụng.
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];

// Ánh xạ mã màu tới chỉ mục của chúng trong mảng. Hữu ích để nhanh chóng xác định xem một màu đã được cập nhật trong một vòng lặp chưa.
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
    obj[code] = i;
    return obj;
}, {});
// Tuples là map keys theo mã màu (hex) với các giá trị { r, g, b } tuples (vẫn chỉ là đối tượng).
const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
    COLOR_TUPLES[hex] = {
        r: parseInt(hex.substr(1, 2), 16),
        g: parseInt(hex.substr(3, 2), 16),
        b: parseInt(hex.substr(5, 2), 16),
    };
});

// lấy random màu.
function randomColorSimple() {
    return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

// Lấy màu ngẫu nhiên, có sẵn một số tùy chọn tùy chỉnh.
let lastColor;

function randomColor(options) {
    const notSame = options && options.notSame;
    const notColor = options && options.notColor;
    const limitWhite = options && options.limitWhite;
    let color = randomColorSimple();

    if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
        color = randomColorSimple();
    }

    if (notSame) {
        while (color === lastColor) {
            color = randomColorSimple();
        }
    } else if (notColor) {
        while (color === notColor) {
            color = randomColorSimple();
        }
    }

    lastColor = color;
    return color;
}

function whiteOrGold() {
    return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}


// Shell helpers
function makePistilColor(shellColor) {
    return (shellColor === COLOR.White || shellColor === COLOR.Gold) ? randomColor({notColor: shellColor}) : whiteOrGold();
}

// Unique shell types
const crysanthemumShell = (size = 1) => {
    const glitter = Math.random() < 0.25;
    const singleColor = Math.random() < 0.72;
    const color = singleColor ? randomColor({limitWhite: true}) : [randomColor(), randomColor({notSame: true})];
    const pistil = singleColor && Math.random() < 0.42;
    const pistilColor = pistil && makePistilColor(color);
    const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White) ? pistilColor || randomColor({
        notColor: color,
        limitWhite: true
    }) : null;
    const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
    let starDensity = glitter ? 1.1 : 1.25;
    if (isLowQuality) starDensity *= 0.8;
    if (isHighQuality) starDensity = 1.2;
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starDensity,
        color,
        secondColor,
        glitter: glitter ? 'light' : '',
        glitterColor: whiteOrGold(),
        pistil,
        pistilColor,
        streamers
    };
};


const ghostShell = (size = 1) => {
    const shell = crysanthemumShell(size);
    shell.starLife *= 1.5;
    let ghostColor = randomColor({notColor: COLOR.White});
    // Always use streamers, and sometimes a pistil
    shell.streamers = true;
    const pistil = Math.random() < 0.42;
    const pistilColor = pistil && makePistilColor(ghostColor);
    shell.color = INVISIBLE;
    shell.secondColor = ghostColor;
// Chúng tôi không muốn sự lấp lánh phát ra từ những ngôi sao vô hình, và hiện tại cũng không
// có cách chuyển trạng thái long lanh. Vì vậy, sẽ vô hiệu hóa nó.
    shell.glitter = '';

    return shell;
};


const strobeShell = (size = 1) => {
    const color = randomColor({limitWhite: true});
    return {
        shellSize: size,
        spreadSize: 280 + size * 92,
        starLife: 1100 + size * 200,
        starLifeVariation: 0.40,
        starDensity: 1.1,
        color,
        glitter: 'light',
        glitterColor: COLOR.White,
        strobe: true,
        strobeColor: Math.random() < 0.5 ? COLOR.White : null,
        pistil: Math.random() < 0.5,
        pistilColor: makePistilColor(color)
    };
};


const palmShell = (size = 1) => {
    const color = randomColor();
    const thick = Math.random() < 0.5;
    return {
        shellSize: size,
        color,
        spreadSize: 250 + size * 75,
        starDensity: thick ? 0.15 : 0.4,
        starLife: 1800 + size * 200,
        glitter: thick ? 'thick' : 'heavy'
    };
};

const ringShell = (size = 1) => {
    const color = randomColor();
    const pistil = Math.random() < 0.75;
    return {
        shellSize: size,
        ring: true,
        color,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starCount: 2.2 * PI_2 * (size + 1),
        pistil,
        pistilColor: makePistilColor(color),
        glitter: !pistil ? 'light' : '',
        glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
        streamers: Math.random() < 0.3
    };
    // return Object.assign({}, defaultShell, config);
};

const crossetteShell = (size = 1) => {
    const color = randomColor({limitWhite: true});
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 750 + size * 160,
        starLifeVariation: 0.4,
        starDensity: 0.85,
        color,
        crossette: true,
        pistil: Math.random() < 0.5,
        pistilColor: makePistilColor(color)
    };
};

const floralShell = (size = 1) => ({
    shellSize: size,
    spreadSize: 300 + size * 120,
    starDensity: 0.12,
    starLife: 500 + size * 50,
    starLifeVariation: 0.5,
    color: Math.random() < 0.65 ? 'random' : (Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({notSame: true})]),
    floral: true
});

const fallingLeavesShell = (size = 1) => ({
    shellSize: size,
    color: INVISIBLE,
    spreadSize: 300 + size * 120,
    starDensity: 0.12,
    starLife: 500 + size * 50,
    starLifeVariation: 0.5,
    glitter: 'medium',
    glitterColor: COLOR.Gold,
    fallingLeaves: true
});

const willowShell = (size = 1) => ({
    shellSize: size,
    spreadSize: 300 + size * 100,
    starDensity: 0.6,
    starLife: 3000 + size * 300,
    glitter: 'willow',
    glitterColor: COLOR.Gold,
    color: INVISIBLE
});

const crackleShell = (size = 1) => {
    // favor gold
    const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
    return {
        shellSize: size,
        spreadSize: 380 + size * 75,
        starDensity: isLowQuality ? 0.65 : 1,
        starLife: 600 + size * 100,
        starLifeVariation: 0.32,
        glitter: 'light',
        glitterColor: COLOR.Gold,
        color,
        crackle: true,
        pistil: Math.random() < 0.65,
        pistilColor: makePistilColor(color)
    };
};

const horsetailShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        horsetail: true,
        color,
        spreadSize: 250 + size * 38,
        starDensity: 0.9,
        starLife: 2500 + size * 300,
        glitter: 'medium',
        glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
// Thêm hiệu ứng nhấp nháy cho đuôi ngựa trắng để làm cho chúng thú vị hơn
        strobe: color === COLOR.White
    };
};

function randomShellName() {
    return Math.random() < 0.5 ? 'Crysanthemum' : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

function randomShell(size) {
    if (IS_HEADER) return randomFastShell()(size);
    // Normal operation
    return shellTypes[randomShellName()](size);
}

function shellFromConfig(size) {
    return shellTypes[shellNameSelector()](size);
}


// Nhận một shell ngẫu nhiên, không bao gồm các biến cường độ xử lý
// Lưu ý rằng đây chỉ là ngẫu nhiên khi Shell "Ngẫu nhiên" được chọn trong cấu hình.
// Ngoài ra, điều này không tạo trình bao, chỉ trả về chức năng xuất xưởng.
const fastShellBlacklist = ['Falling Leaves', 'Floral', 'Willow'];

function randomFastShell() {
    const isRandom = shellNameSelector() === 'Random';
    let shellName = isRandom ? randomShellName() : shellNameSelector();
    if (isRandom) {
        while (fastShellBlacklist.includes(shellName)) {
            shellName = randomShellName();
        }
    }
    return shellTypes[shellName];
}


const shellTypes = {
    'Random': randomShell,
    'Crackle': crackleShell,
    'Crossette': crossetteShell,
    'Crysanthemum': crysanthemumShell,
    'Falling Leaves': fallingLeavesShell,
    'Floral': floralShell,
    'Ghost': ghostShell,
    'Horse Tail': horsetailShell,
    'Palm': palmShell,
    'Ring': ringShell,
    'Strobe': strobeShell,
    'Willow': willowShell
};

const shellNames = Object.keys(shellTypes);
function init() {
    // Remove loading state
    document.querySelector('.loading-init').remove();
    appNodes.stageContainer.classList.remove('remove');

    // Populate dropdowns
    function setOptionsForSelect(node, options) {
        node.innerHTML = options.reduce((acc, opt) => acc += `<option value="${opt.value}">${opt.label}</option>`, '');
    }

    // shell type
    let options = '';
    shellNames.forEach(opt => options += `<option value="${opt}">${opt}</option>`);
    appNodes.shellType.innerHTML = options;
    // shell size
    options = '';
    ['3"', '4"', '6"', '8"', '12"', '16"'].forEach((opt, i) => options += `<option value="${i}">${opt}</option>`);
    appNodes.shellSize.innerHTML = options;

    setOptionsForSelect(appNodes.quality, [
        {label: 'Thấp', value: QUALITY_LOW},
        {label: 'thông thường', value: QUALITY_NORMAL},
        {label: 'cao', value: QUALITY_HIGH}
    ]);

    setOptionsForSelect(appNodes.skyLighting, [
        {label: 'Dừng', value: SKY_LIGHT_NONE},
        {label: 'Tối', value: SKY_LIGHT_DIM},
        {label: 'Bình thường', value: SKY_LIGHT_NORMAL}
    ]);

    // 0.9 is mobile default
    setOptionsForSelect(
        appNodes.scaleFactor,
        [0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0]
            .map(value => ({value: value.toFixed(2), label: `${value * 100}%`}))
    );

    // Begin simulation
    togglePause(false);

    // initial render
    renderApp(store.state);

    // Apply initial config
    configDidUpdate();
}


function fitShellPositionInBoundsH(position) {
    const edge = 0.18;
    return (1 - edge * 2) * position + edge;
}

function fitShellPositionInBoundsV(position) {
    return position * 0.75;
}

function getRandomShellPositionH() {
    return fitShellPositionInBoundsH(Math.random());
}

function getRandomShellPositionV() {
    return fitShellPositionInBoundsV(Math.random());
}

function getRandomShellSize() {
    const baseSize = shellSizeSelector();
    const maxVariance = Math.min(2.5, baseSize);
    const variance = Math.random() * maxVariance;
    const size = baseSize - variance;
    const height = maxVariance === 0 ? Math.random() : 1 - (variance / maxVariance);
    const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
    const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
    return {
        size,
        x: fitShellPositionInBoundsH(x),
        height: fitShellPositionInBoundsV(height)
    };
}


// Launches a shell from a user pointer event, based on state.config
function launchShellFromConfig(event) {
    const shell = new Shell(shellFromConfig(shellSizeSelector()));
    const w = mainStage.width;
    const h = mainStage.height;

    shell.launch(
        event ? event.x / w : getRandomShellPositionH(),
        event ? 1 - event.y / h : getRandomShellPositionV()
    );
}


// Sequences
// -----------

function seqRandomShell() {
    const size = getRandomShellSize();
    const shell = new Shell(shellFromConfig(size.size));
    shell.launch(size.x, size.height);

    let extraDelay = shell.starLife;
    if (shell.fallingLeaves) {
        extraDelay = 4600;
    }

    return 900 + Math.random() * 600 + extraDelay;
}

function seqRandomFastShell() {
    const shellType = randomFastShell();
    const size = getRandomShellSize();
    const shell = new Shell(shellType(size.size));
    shell.launch(size.x, size.height);

    let extraDelay = shell.starLife;

    return 900 + Math.random() * 600 + extraDelay;
}

function seqTwoRandom() {
    const size1 = getRandomShellSize();
    const size2 = getRandomShellSize();
    const shell1 = new Shell(shellFromConfig(size1.size));
    const shell2 = new Shell(shellFromConfig(size2.size));
    const leftOffset = Math.random() * 0.2 - 0.1;
    const rightOffset = Math.random() * 0.2 - 0.1;
    shell1.launch(0.3 + leftOffset, size1.height);
    setTimeout(() => {
        shell2.launch(0.7 + rightOffset, size2.height);
    }, 100);

    let extraDelay = Math.max(shell1.starLife, shell2.starLife);
    if (shell1.fallingLeaves || shell2.fallingLeaves) {
        extraDelay = 4600;
    }

    return 900 + Math.random() * 600 + extraDelay;
}

function seqTriple() {
    const shellType = randomFastShell();
    const baseSize = shellSizeSelector();
    const smallSize = Math.max(0, baseSize - 1.25);

    const offset = Math.random() * 0.08 - 0.04;
    const shell1 = new Shell(shellType(baseSize));
    shell1.launch(0.5 + offset, 0.7);

    const leftDelay = 1000 + Math.random() * 400;
    const rightDelay = 1000 + Math.random() * 400;

    setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04;
        const shell2 = new Shell(shellType(smallSize));
        shell2.launch(0.2 + offset, 0.1);
    }, leftDelay);

    setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04;
        const shell3 = new Shell(shellType(smallSize));
        shell3.launch(0.8 + offset, 0.1);
    }, rightDelay);

    return 4000;
}

function seqPyramid() {
    const barrageCountHalf = IS_DESKTOP ? 7 : 4;
    const largeSize = shellSizeSelector();
    const smallSize = Math.max(0, largeSize - 3);
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
    const randomSpecialShell = randomShell;

    function launchShell(x, useSpecial) {
        const isRandom = shellNameSelector() === 'Random';
        let shellType = isRandom
            ? useSpecial ? randomSpecialShell : randomMainShell
            : shellTypes[shellNameSelector()];
        const shell = new Shell(shellType(useSpecial ? largeSize : smallSize));
        const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
        shell.launch(x, useSpecial ? 0.75 : height * 0.42);
    }

    let count = 0;
    let delay = 0;
    while (count <= barrageCountHalf) {
        if (count === barrageCountHalf) {
            setTimeout(() => {
                launchShell(0.5, true);
            }, delay);
        } else {
            const offset = count / barrageCountHalf * 0.5;
            const delayOffset = Math.random() * 30 + 30;
            setTimeout(() => {
                launchShell(offset, false);
            }, delay);
            setTimeout(() => {
                launchShell(1 - offset, false);
            }, delay + delayOffset);
        }

        count++;
        delay += 200;
    }

    return 3400 + barrageCountHalf * 250;
}

function seqSmallBarrage() {
    seqSmallBarrage.lastCalled = Date.now();
    const barrageCount = IS_DESKTOP ? 11 : 5;
    const specialIndex = IS_DESKTOP ? 3 : 1;
    const shellSize = Math.max(0, shellSizeSelector() - 2);
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
    const randomSpecialShell = randomFastShell();

// (cos(x*5π+0.5π)+1)/2 là sóng tùy chỉnh được giới hạn bởi 0 và 1 được sử dụng để đặt các độ cao khởi chạy khác nhau
    function launchShell(x, useSpecial) {
        const isRandom = shellNameSelector() === 'Random';
        let shellType = isRandom
            ? useSpecial ? randomSpecialShell : randomMainShell
            : shellTypes[shellNameSelector()];
        const shell = new Shell(shellType(shellSize));
        const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
        shell.launch(x, height * 0.75);
    }

    let count = 0;
    let delay = 0;
    while (count < barrageCount) {
        if (count === 0) {
            launchShell(0.5, false)
            count += 1;
        } else {
            const offset = (count + 1) / barrageCount / 2;
            const delayOffset = Math.random() * 30 + 30;
            const useSpecial = count === specialIndex;
            setTimeout(() => {
                launchShell(0.5 + offset, useSpecial);
            }, delay);
            setTimeout(() => {
                launchShell(0.5 - offset, useSpecial);
            }, delay + delayOffset);
            count += 2;
        }
        delay += 200;
    }

    return 3400 + barrageCount * 120;
}

seqSmallBarrage.cooldown = 15000;
seqSmallBarrage.lastCalled = Date.now();


const sequences = [
    seqRandomShell,
    seqTwoRandom,
    seqTriple,
    seqPyramid,
    seqSmallBarrage
];


let isFirstSeq = true;
const finaleCount = 32;
let currentFinaleCount = 0;

function startSequence() {
    if (isFirstSeq) {
        isFirstSeq = false;
        if (IS_HEADER) {
            return seqTwoRandom();
        } else {
            const shell = new Shell(crysanthemumShell(shellSizeSelector()));
            shell.launch(0.5, 0.5);
            return 2400;
        }
    }

    if (finaleSelector()) {
        seqRandomFastShell();
        if (currentFinaleCount < finaleCount) {
            currentFinaleCount++;
            return 170;
        } else {
            currentFinaleCount = 0;
            return 6000;
        }
    }

    const rand = Math.random();

    if (rand < 0.08 && Date.now() - seqSmallBarrage.lastCalled > seqSmallBarrage.cooldown) {
        return seqSmallBarrage();
    }

    if (rand < 0.1) {
        return seqPyramid();
    }

    if (rand < 0.6 && !IS_HEADER) {
        return seqRandomShell();
    } else if (rand < 0.8) {
        return seqTwoRandom();
    } else if (rand < 1) {
        return seqTriple();
    }
}


let activePointerCount = 0;
let isUpdatingSpeed = false;

function handlePointerStart(event) {
    activePointerCount++;
    const btnSize = 50;

    if (event.y < btnSize) {
        if (event.x < btnSize) {
            togglePause();
            return;
        }
        if (event.x > mainStage.width / 2 - btnSize / 2 && event.x < mainStage.width / 2 + btnSize / 2) {
            toggleSound();
            return;
        }
        if (event.x > mainStage.width - btnSize) {
            toggleMenu();
            return;
        }
    }

    if (!isRunning()) return;

    if (updateSpeedFromEvent(event)) {
        isUpdatingSpeed = true;
    } else if (event.onCanvas) {
        launchShellFromConfig(event);
    }
}

function handlePointerEnd(event) {
    activePointerCount--;
    isUpdatingSpeed = false;
}

function handlePointerMove(event) {
    if (!isRunning()) return;

    if (isUpdatingSpeed) {
        updateSpeedFromEvent(event);
    }
}

function handleKeydown(event) {
    // P
    if (event.keyCode === 80) {
        togglePause();
    }
    // O
    else if (event.keyCode === 79) {
        toggleMenu();
    }
    // Esc
    else if (event.keyCode === 27) {
        toggleMenu(false);
    }
}

mainStage.addEventListener('pointerstart', handlePointerStart);
mainStage.addEventListener('pointerend', handlePointerEnd);
mainStage.addEventListener('pointermove', handlePointerMove);
window.addEventListener('keydown', handleKeydown);


// Account for window resize and custom scale changes.
function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const containerW = Math.min(w, MAX_WIDTH);
    const containerH = w <= 420 ? h : Math.min(h, MAX_HEIGHT);
    appNodes.stageContainer.style.width = containerW + 'px';
    appNodes.stageContainer.style.height = containerH + 'px';
    stages.forEach(stage => stage.resize(containerW, containerH));
    // Account for scale
    const scaleFactor = scaleFactorSelector();
    stageW = containerW / scaleFactor;
    stageH = containerH / scaleFactor;
}

// Compute initial dimensions
handleResize();

window.addEventListener('resize', handleResize);


// Dynamic globals
let currentFrame = 0;
let speedBarOpacity = 0;
let autoLaunchTime = 0;

function updateSpeedFromEvent(event) {
    if (isUpdatingSpeed || event.y >= mainStage.height - 44) {
        // Trên điện thoại, rất khó để chạm vào các pixel cạnh để đặt tốc độ ở mức 0 hoặc 1, do đó, một số phần đệm được cung cấp để giúp việc đó dễ dàng hơn.
        const edge = 16;
        const newSpeed = (event.x - edge) / (mainStage.width - edge * 2);
        simSpeed = Math.min(Math.max(newSpeed, 0), 1);
        // show speed bar after an update
        speedBarOpacity = 1;
        // If we updated the speed, return true
        return true;
    }
    // Return false if the speed wasn't updated
    return false;
}


// Extracted function to keep `update()` optimized
function updateGlobals(timeStep, lag) {
    currentFrame++;

    // Always try to fade out speed bar
    if (!isUpdatingSpeed) {
        speedBarOpacity -= lag / 30; // half a second
        if (speedBarOpacity < 0) {
            speedBarOpacity = 0;
        }
    }

    // auto launch shells
    if (store.state.config.autoLaunch) {
        autoLaunchTime -= timeStep;
        if (autoLaunchTime <= 0) {
            autoLaunchTime = startSequence() * 1.25;
        }
    }
}


function update(frameTime, lag) {
    if (!isRunning()) return;

    const width = stageW;
    const height = stageH;
    const timeStep = frameTime * simSpeed;
    const speed = simSpeed * lag;

    updateGlobals(timeStep, lag);

    const starDrag = 1 - (1 - Star.airDrag) * speed;
    const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
    const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
    const gAcc = timeStep / 1000 * GRAVITY;
    COLOR_CODES_W_INVIS.forEach(color => {
        // Stars
        const stars = Star.active[color];
        for (let i = stars.length - 1; i >= 0; i = i - 1) {
            const star = stars[i];
            // Chỉ cập nhật mỗi ngôi sao một lần trên mỗi khung hình. Vì màu sắc có thể thay đổi nên có thể một ngôi sao có thể cập nhật hai lần mà không có điều này, dẫn đến một "bước nhảy".
            if (star.updateFrame === currentFrame) {
                continue;
            }
            star.updateFrame = currentFrame;

            star.life -= timeStep;
            if (star.life <= 0) {
                stars.splice(i, 1);
                Star.returnInstance(star);
            } else {
                const burnRate = Math.pow(star.life / star.fullLife, 0.5);
                const burnRateInverse = 1 - burnRate;

                star.prevX = star.x;
                star.prevY = star.y;
                star.x += star.speedX * speed;
                star.y += star.speedY * speed;
                if (!star.heavy) {
                    star.speedX *= starDrag;
                    star.speedY *= starDrag;
                } else {
                    star.speedX *= starDragHeavy;
                    star.speedY *= starDragHeavy;
                }
                star.speedY += gAcc;

                if (star.spinRadius) {
                    star.spinAngle += star.spinSpeed * speed;
                    star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
                    star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
                }

                if (star.sparkFreq) {
                    star.sparkTimer -= timeStep;
                    while (star.sparkTimer < 0) {
                        star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
                        Spark.add(
                            star.x,
                            star.y,
                            star.sparkColor,
                            Math.random() * PI_2,
                            Math.random() * star.sparkSpeed * burnRate,
                            star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife
                        );
                    }
                }

                // Handle star transitions
                if (star.life < star.transitionTime) {
                    if (star.secondColor && !star.colorChanged) {
                        star.colorChanged = true;
                        star.color = star.secondColor;
                        stars.splice(i, 1);
                        Star.active[star.secondColor].push(star);
                        if (star.secondColor === INVISIBLE) {
                            star.sparkFreq = 0;
                        }
                    }

                    if (star.strobe) {
                        star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
                    }
                }
            }
        }

        // Sparks
        const sparks = Spark.active[color];
        for (let i = sparks.length - 1; i >= 0; i = i - 1) {
            const spark = sparks[i];
            spark.life -= timeStep;
            if (spark.life <= 0) {
                sparks.splice(i, 1);
                Spark.returnInstance(spark);
            } else {
                spark.prevX = spark.x;
                spark.prevY = spark.y;
                spark.x += spark.speedX * speed;
                spark.y += spark.speedY * speed;
                spark.speedX *= sparkDrag;
                spark.speedY *= sparkDrag;
                spark.speedY += gAcc;
            }
        }
    });

    render(speed);
}

function render(speed) {
    const {dpr} = mainStage;
    const width = stageW;
    const height = stageH;
    const trailsCtx = trailsStage.ctx;
    const mainCtx = mainStage.ctx;

    if (skyLightingSelector() !== SKY_LIGHT_NONE) {
        colorSky(speed);
    }

    // Account for high DPI screens, and custom scale factor.
    const scaleFactor = scaleFactorSelector();
    trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
    mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

    trailsCtx.globalCompositeOperation = 'source-over';
    trailsCtx.fillStyle = `rgba(0, 0, 0, ${store.state.config.longExposure ? 0.0025 : 0.175 * speed})`;
    trailsCtx.fillRect(0, 0, width, height);

    mainCtx.clearRect(0, 0, width, height);
    // Vẽ các chớp liên tiếp xếp hàng đợi
    // Những thứ này cũng phải được vẽ bằng mã nguồn do Safari. Thay vào đó, có vẻ như hiển thị độ dốc bằng cách sử dụng các hộp màu đen lớn để làm sáng.
    // Rất may, những chớp sáng liên tục này trông khá giống nhau.
    while (BurstFlash.active.length) {
        const bf = BurstFlash.active.pop();

        const burstGradient = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
        burstGradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)');
        burstGradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)');
        burstGradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)');
        burstGradient.addColorStop(1, 'rgba(255, 120, 20, 0)');
        trailsCtx.fillStyle = burstGradient;
        trailsCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);

        BurstFlash.returnInstance(bf);
    }

    // Remaining drawing on trails canvas will use 'lighten' blend mode
    trailsCtx.globalCompositeOperation = 'lighten';

    // Draw stars
    trailsCtx.lineWidth = Star.drawWidth;
    trailsCtx.lineCap = isLowQuality ? 'square' : 'round';
    mainCtx.strokeStyle = '#fff';
    mainCtx.lineWidth = 1;
    mainCtx.beginPath();
    COLOR_CODES.forEach(color => {
        const stars = Star.active[color];
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        stars.forEach(star => {
            if (star.visible) {
                trailsCtx.moveTo(star.x, star.y);
                trailsCtx.lineTo(star.prevX, star.prevY);
                mainCtx.moveTo(star.x, star.y);
                mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
            }
        });
        trailsCtx.stroke();
    });
    mainCtx.stroke();

    // Draw sparks
    trailsCtx.lineWidth = Spark.drawWidth;
    trailsCtx.lineCap = 'butt';
    COLOR_CODES.forEach(color => {
        const sparks = Spark.active[color];
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        sparks.forEach(spark => {
            trailsCtx.moveTo(spark.x, spark.y);
            trailsCtx.lineTo(spark.prevX, spark.prevY);
        });
        trailsCtx.stroke();
    });


    // Render speed bar if visible
    if (speedBarOpacity) {
        const speedBarHeight = 6;
        mainCtx.globalAlpha = speedBarOpacity;
        mainCtx.fillStyle = COLOR.Blue;
        mainCtx.fillRect(0, height - speedBarHeight, width * simSpeed, speedBarHeight);
        mainCtx.globalAlpha = 1;
    }


    trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
}


// Vẽ lớp phủ màu dựa trên độ sáng kết hợp của các ngôi sao (thắp sáng bầu trời!)
// Lưu ý: điều này được áp dụng cho màu nền của vùng chứa canvas, vì vậy nó nằm sau các hạt
const currentSkyColor = {r: 0, g: 0, b: 0};
const targetSkyColor = {r: 0, g: 0, b: 0};

function colorSky(speed) {

    // Giá trị r, g hoặc b tối đa sẽ được sử dụng (255 sẽ không đại diện cho giá trị tối đa)
    const maxSkySaturation = skyLightingSelector() * 15;
    // Cần có tổng cộng bao nhiêu ngôi sao để đạt được độ sáng bầu trời tối đa
    const maxStarCount = 500;
    let totalStarCount = 0;
    // Initialize sky as black
    targetSkyColor.r = 0;
    targetSkyColor.g = 0;
    targetSkyColor.b = 0;
    // Thêm từng màu đã biết vào bầu trời, nhân với số hạt của màu đó. Điều này sẽ đặt các giá trị RGB vượt quá giới hạn, nhưng chúng tôi sẽ thu nhỏ chúng lại sau.
    // Cũng cộng tổng số sao.
    COLOR_CODES.forEach(color => {
        const tuple = COLOR_TUPLES[color];
        const count = Star.active[color].length;
        totalStarCount += count;
        targetSkyColor.r += tuple.r * count;
        targetSkyColor.g += tuple.g * count;
        targetSkyColor.b += tuple.b * count;
    });

    // Cường độ kẹp ở 1.0 và ánh xạ tới một đường cong phi tuyến tính tùy chỉnh. Điều này cho phép một vài ngôi sao thắp sáng bầu trời một cách rõ ràng, trong khi nhiều ngôi sao tiếp tục tăng độ sáng nhưng với tốc độ thấp hơn. Điều này phù hợp hơn với nhận thức về độ sáng phi tuyến tính của con người.
    const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3);
    // Tìm ra thành phần màu nào có giá trị cao nhất, vì vậy chúng ta có thể chia tỷ lệ chúng mà không ảnh hưởng đến tỷ lệ.
    // Ngăn chặn 0 được sử dụng, vì vậy chúng tôi không chia cho 0 trong bước tiếp theo.
    const maxColorComponent = Math.max(1, targetSkyColor.r, targetSkyColor.g, targetSkyColor.b);
    // Chia tỷ lệ tất cả các thành phần màu thành tối đa `maxSkySaturation` và áp dụng cường độ.
    targetSkyColor.r = targetSkyColor.r / maxColorComponent * maxSkySaturation * intensity;
    targetSkyColor.g = targetSkyColor.g / maxColorComponent * maxSkySaturation * intensity;
    targetSkyColor.b = targetSkyColor.b / maxColorComponent * maxSkySaturation * intensity;

    // Animate thay đổi màu sắc để làm mượt quá trình chuyển đổi.
    const colorChange = 10;
    currentSkyColor.r += (targetSkyColor.r - currentSkyColor.r) / colorChange * speed;
    currentSkyColor.g += (targetSkyColor.g - currentSkyColor.g) / colorChange * speed;
    currentSkyColor.b += (targetSkyColor.b - currentSkyColor.b) / colorChange * speed;

    appNodes.canvasContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`;
}

mainStage.addEventListener('ticker', update);


// Trình trợ giúp được sử dụng để trải hạt ngẫu nhiên trên một cung
// Các giá trị linh hoạt - `start` và `arcLength` có thể âm và `randomness` chỉ đơn giản là hệ số nhân cho phép cộng ngẫu nhiên.
function createParticleArc(start, arcLength, count, randomness, particleFactory) {
    const angleDelta = arcLength / count;

    // Đôi khi có thêm một trợ từ ở cuối, quá gần với phần đầu. Trừ một nửa angleDelta đảm bảo bỏ qua.
    // Sẽ tốt hơn nếu sửa lỗi này theo cách tốt hơn.
    const end = start + arcLength - (angleDelta * 0.5);

    if (end > start) {
        // Tối ưu hóa: `angle=angle+angleDelta` so với angle+=angleDelta
        // V8 hủy tối ưu hóa bằng phép gán hợp chất let
        for (let angle = start; angle < end; angle = angle + angleDelta) {
            particleFactory(angle + Math.random() * angleDelta * randomness);
        }
    } else {
        for (let angle = start; angle > end; angle = angle + angleDelta) {
            particleFactory(angle + Math.random() * angleDelta * randomness);
        }
    }
}


/**
 * Helper dùng để tạo ra một vụ nổ hình cầu của các hạt.
 *
 * @param {Number} count Số lượng sao/hạt mong muốn. Giá trị này là một gợi ý, và
 * vụ nổ được tạo ra có thể có nhiều hạt hơn. Thuật toán hiện tại không thể hoàn hảo
 * phân bố đều một số điểm cụ thể trên bề mặt hình cầu.
 * @param {Function} particleFactory Được gọi một lần cho mỗi sao/hạt được tạo. Đã thông qua hai đối số:
 * `angle`: Hướng của ngôi sao/hạt.
 * `tốc độ`: Hệ số nhân cho tốc độ hạt, từ 0,0 đến 1,0.
 * @param {Number} startAngle=0 Đối với các vụ nổ được phân đoạn, bạn chỉ có thể tạo ra một phần cung của các hạt. Cái này
 * cho phép đặt góc cung bắt đầu (radian).
 * @param {Number} arcLength=TAU Độ dài của cung (radian). Mặc định là một vòng tròn đầy đủ.
 *
 * @return {void} Không trả lại gì; tùy thuộc vào `particleFactory` để sử dụng dữ liệu đã cho.
 */
function createBurst(count, particleFactory, startAngle = 0, arcLength = PI_2) {
    // Giả sử hình cầu có diện tích bề mặt là `count`, tính các
    // tính chất của quả cầu nói trên (đơn vị là các ngôi sao).
    // Bán kính
    const R = 0.5 * Math.sqrt(count / Math.PI);
    // Đường tròn
    const C = 2 * R * Math.PI;
    // Nửa chu vi
    const C_HALF = C / 2;

    // Tạo một loạt các vòng, định cỡ chúng như thể chúng cách đều nhau
    // dọc theo mặt cong của hình cầu.
    for (let i = 0; i <= C_HALF; i++) {
        const ringAngle = i / C_HALF * PI_HALF;
        const ringSize = Math.cos(ringAngle);
        const partsPerFullRing = C * ringSize;
        const partsPerArc = partsPerFullRing * (arcLength / PI_2);

        const angleInc = PI_2 / partsPerFullRing;
        const angleOffset = Math.random() * angleInc + startAngle;

    // Mỗi hạt cần một chút ngẫu nhiên để cải thiện hình thức.
        const maxRandomAngleOffset = angleInc * 0.33;

        for (let i = 0; i < partsPerArc; i++) {
            const randomAngleOffset = Math.random() * maxRandomAngleOffset;
            let angle = angleInc * i + angleOffset + randomAngleOffset;
            particleFactory(angle, ringSize);
        }
    }
}



// Các hiệu ứng ngôi sao khác nhau.
// Chúng được thiết kế để gắn vào sự kiện `onDeath` của một ngôi sao.

// Crossette chia ngôi sao thành bốn mảnh cùng màu phân nhánh theo hình chữ thập.
function crossetteEffect(star) {
    const startAngle = Math.random() * PI_HALF;
    createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
        Star.add(
            star.x,
            star.y,
            star.color,
            angle,
            Math.random() * 0.6 + 0.75,
            600
        );
    });
}

// Hoa giống như một cái vỏ nhỏ
function floralEffect(star) {
    const count = 12 + 6 * quality;
    createBurst(count, (angle, speedMult) => {
        Star.add(
            star.x,
            star.y,
            star.color,
            angle,
            speedMult * 2.4,
            1000 + Math.random() * 300,
            star.speedX,
            star.speedY
        );
    });
    // Queue burst flash render
    BurstFlash.add(star.x, star.y, 46);
    soundManager.playSound('burstSmall');
}

// Hoa nở liễu sao
function fallingLeavesEffect(star) {
    createBurst(7, (angle, speedMult) => {
        const newStar = Star.add(
            star.x,
            star.y,
            INVISIBLE,
            angle,
            speedMult * 2.4,
            2400 + Math.random() * 600,
            star.speedX,
            star.speedY
        );

        newStar.sparkColor = COLOR.Gold;
        newStar.sparkFreq = 144 / quality;
        newStar.sparkSpeed = 0.28;
        newStar.sparkLife = 750;
        newStar.sparkLifeVariation = 3.2;
    });
    // Queue burst flash render
    BurstFlash.add(star.x, star.y, 46);
    soundManager.playSound('burstSmall');
}


// Crackle bật thành một đám mây tia lửa vàng nhỏ.
function crackleEffect(star) {
    const count = isHighQuality ? 32 : 16;
    createParticleArc(0, PI_2, count, 1.8, (angle) => {
        Spark.add(
            star.x,
            star.y,
            COLOR.Gold,
            angle,
            // áp dụng gần mức giảm khối cho tốc độ (đặt nhiều hạt hơn ra bên ngoài)
            Math.pow(Math.random(), 0.45) * 2.4,
            300 + Math.random() * 200
        );
    });
}


/**
 * Vỏ có thể được xây dựng với các tùy chọn:
 *
 * spreadSize:      Kích thước của vụ nổ.
 * starCount: Số sao để tạo. Đây là tùy chọn và sẽ được đặt thành số lượng hợp lý cho kích thước nếu bỏ qua.
 * starLife:
 * starLifeVariation:
 * color:
 * glitterColor:
 * glitter: One of: 'light', 'medium', 'heavy', 'streamer', 'willow'
 * pistil:
 * pistilColor:
 * streamers:
 * crossette:
 * floral:
 * crackle:
 */
class Shell {
    constructor(options) {
        Object.assign(this, options);
        this.starLifeVariation = options.starLifeVariation || 0.125;
        this.color = options.color || randomColor();
        this.glitterColor = options.glitterColor || this.color;

        // Đặt starCount mặc định nếu cần, sẽ dựa trên kích thước vỏ và tỷ lệ theo cấp số nhân, giống như diện tích bề mặt của hình cầu.
        if (!this.starCount) {
            const density = options.starDensity || 1;
            const scaledSize = this.spreadSize / 54;
            this.starCount = Math.max(6, scaledSize * scaledSize * density);
        }
    }

    launch(position, launchHeight) {
        const width = stageW;
        const height = stageH;
        // Khoảng cách từ các cạnh của màn hình để giữ vỏ.
        const hpad = 60;
        // Khoảng cách từ đỉnh màn hình để giữ cho vỏ nổ.
        const vpad = 50;
        // Chiều cao bùng nổ tối thiểu, theo tỷ lệ phần trăm của chiều cao giai đoạn
        const minHeightPercent = 0.45;
        // Chiều cao chùm tối thiểu tính bằng px
        const minHeight = height - height * minHeightPercent;

        const launchX = position * (width - hpad * 2) + hpad;
        const launchY = height;
        const burstY = minHeight - (launchHeight * (minHeight - vpad));

        const launchDistance = launchY - burstY;
        // Sử dụng đường cong công suất tùy chỉnh để tính gần đúng Vi cần thiết để đạt được launchDistance dưới tác dụng của trọng lực và lực cản của không khí.
        // Số ma thuật đến từ thử nghiệm.
        const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);

        const comet = this.comet = Star.add(
            launchX,
            launchY,
            typeof this.color === 'string' && this.color !== 'random' ? this.color : COLOR.White,
            Math.PI,
            launchVelocity * (this.horsetail ? 1.2 : 1),
            // Hang time is derived linearly from Vi; exact number came from testing
            launchVelocity * (this.horsetail ? 100 : 400)
        );

        comet.heavy = true;
        // vệt tên lửa
        comet.spinRadius = MyMath.random(0.32, 0.85);
        comet.sparkFreq = 32 / quality;
        if (isHighQuality) comet.sparkFreq = 8;
        comet.sparkLife = 320;
        comet.sparkLifeVariation = 3;
        if (this.glitter === 'willow' || this.fallingLeaves) {
            comet.sparkFreq = 20 / quality;
            comet.sparkSpeed = 0.5;
            comet.sparkLife = 500;
        }
        if (this.color === INVISIBLE) {
            comet.sparkColor = COLOR.Gold;
        }

        // Ngẫu nhiên khiến sao chổi "cháy hàng" sớm một chút.
        // Điều này bị vô hiệu hóa , do thời gian phát sóng rất ngắn của chúng.
        if (Math.random() > 0.4 && !this.horsetail) {
            comet.secondColor = INVISIBLE;
            comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
        }

        comet.onDeath = comet => this.burst(comet.x, comet.y);

        soundManager.playSound('lift');
    }

    burst(x, y) {

// Đặt tốc độ cụm sao cho cụm tổng thể tăng theo kích thước đã đặt. Công thức cụ thể này được lấy từ thử nghiệm và bị ảnh hưởng bởi lực cản không khí mô phỏng.
        const speed = this.spreadSize / 96;

        let color, onDeath, sparkFreq, sparkSpeed, sparkLife;
        let sparkLifeVariation = 0.25;

// Một số hiệu ứng chết chóc, như crackle, phát ra âm thanh, nhưng chỉ nên phát một lần.
        let playedDeathSound = false;
        if (this.crossette) onDeath = (star) => {
            if (!playedDeathSound) {
                soundManager.playSound('crackleSmall');
                playedDeathSound = true;
            }
            crossetteEffect(star);
        }
        if (this.crackle) onDeath = (star) => {
            if (!playedDeathSound) {
                soundManager.playSound('crackle');
                playedDeathSound = true;
            }
            crackleEffect(star);
        }
        if (this.floral) onDeath = floralEffect;
        if (this.fallingLeaves) onDeath = fallingLeavesEffect;

        if (this.glitter === 'light') {
            sparkFreq = 400;
            sparkSpeed = 0.3;
            sparkLife = 300;
            sparkLifeVariation = 2;
        } else if (this.glitter === 'medium') {
            sparkFreq = 200;
            sparkSpeed = 0.44;
            sparkLife = 700;
            sparkLifeVariation = 2;
        } else if (this.glitter === 'heavy') {
            sparkFreq = 80;
            sparkSpeed = 0.8;
            sparkLife = 1400;
            sparkLifeVariation = 2;
        } else if (this.glitter === 'thick') {
            sparkFreq = 16;
            sparkSpeed = isHighQuality ? 1.65 : 1.5;
            sparkLife = 1400;
            sparkLifeVariation = 3;
        } else if (this.glitter === 'streamer') {
            sparkFreq = 32;
            sparkSpeed = 1.05;
            sparkLife = 620;
            sparkLifeVariation = 2;
        } else if (this.glitter === 'willow') {
            sparkFreq = 120;
            sparkSpeed = 0.34;
            sparkLife = 1400;
            sparkLifeVariation = 3.8;
        }

        sparkFreq = sparkFreq / quality;
        let firstStar = true;
        const starFactory = (angle, speedMult) => {
            // Đối với đạn không đuôi ngựa, hãy tính tốc độ thẳng đứng ban đầu để thêm vào vụ nổ sao.
            // Con số kỳ diệu đến từ việc thử nghiệm những gì có vẻ tốt nhất. Lý tưởng là tất cả vỏ
            // các vụ nổ xuất hiện tập trung trực quan vào phần lớn thời gian sống của sao (không bao gồm cây liễu, v.v.)
            const standardInitialSpeed = this.spreadSize / 1800;

            const star = Star.add(
                x,
                y,
                color || randomColor(),
                angle,
                speedMult * speed,
                // add minor variation to star life
                this.starLife + Math.random() * this.starLife * this.starLifeVariation,
                this.horsetail ? this.comet && this.comet.speedX : 0,
                this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed
            );

            if (this.secondColor) {
                star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32);
                star.secondColor = this.secondColor;
            }

            if (this.strobe) {
                star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46);
                star.strobe = true;
                // Có bao nhiêu mili giây giữa các lần chuyển đổi trạng thái nhấp nháy "tick". Lưu ý rằng mô hình nhấp nháy
                // đang bật: tắt: tắt, vì vậy đây là thời lượng "bật", trong khi thời lượng "tắt" dài gấp đôi.
                star.strobeFreq = Math.random() * 20 + 40;
                if (this.strobeColor) {
                    star.secondColor = this.strobeColor;
                }
            }

            star.onDeath = onDeath;

            if (this.glitter) {
                star.sparkFreq = sparkFreq;
                star.sparkSpeed = sparkSpeed;
                star.sparkLife = sparkLife;
                star.sparkLifeVariation = sparkLifeVariation;
                star.sparkColor = this.glitterColor;
                star.sparkTimer = Math.random() * star.sparkFreq;
            }
        };


        if (typeof this.color === 'string') {
            if (this.color === 'random') {
                color = null; // falsey value creates random color in starFactory
            } else {
                color = this.color;
            }

            // Các vòng có vị trí ngẫu nhiên, nhưng được xoay ngẫu nhiên
            if (this.ring) {
                const ringStartAngle = Math.random() * Math.PI;
                const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15;
                ;

                createParticleArc(0, PI_2, this.starCount, 0, angle => {
                    // Create a ring, squashed horizontally
                    const initSpeedX = Math.sin(angle) * speed * ringSquash;
                    const initSpeedY = Math.cos(angle) * speed;
                    // Rotate ring
                    const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY);
                    const newAngle = MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle;
                    const star = Star.add(
                        x,
                        y,
                        color,
                        newAngle,
                        newSpeed,
                        this.starLife + Math.random() * this.starLife * this.starLifeVariation
                    );

                    if (this.glitter) {
                        star.sparkFreq = sparkFreq;
                        star.sparkSpeed = sparkSpeed;
                        star.sparkLife = sparkLife;
                        star.sparkLifeVariation = sparkLifeVariation;
                        star.sparkColor = this.glitterColor;
                        star.sparkTimer = Math.random() * star.sparkFreq;
                    }
                });
            }
            else {
                createBurst(this.starCount, starFactory);
            }
        } else if (Array.isArray(this.color)) {
            if (Math.random() < 0.5) {
                const start = Math.random() * Math.PI;
                const start2 = start + Math.PI;
                const arc = Math.PI;
                color = this.color[0];
                // Không tạo một vòng cung đầy đủ sẽ tự động giảm số lượng sao.
                createBurst(this.starCount, starFactory, start, arc);
                color = this.color[1];
                createBurst(this.starCount, starFactory, start2, arc);
            } else {
                color = this.color[0];
                createBurst(this.starCount / 2, starFactory);
                color = this.color[1];
                createBurst(this.starCount / 2, starFactory);
            }
        } else {
            throw new Error('Invalid shell color. Expected string or array of strings, but got: ' + this.color);
        }

        if (this.pistil) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.5,
                starLife: this.starLife * 0.6,
                starLifeVariation: this.starLifeVariation,
                starDensity: 1.4,
                color: this.pistilColor,
                glitter: 'light',
                glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White
            });
            innerShell.burst(x, y);
        }

        if (this.streamers) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.9,
                starLife: this.starLife * 0.8,
                starLifeVariation: this.starLifeVariation,
                starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
                color: COLOR.White,
                glitter: 'streamer'
            });
            innerShell.burst(x, y);
        }

        BurstFlash.add(x, y, this.spreadSize / 4);

        // Phát âm thanh, nhưng chỉ cho shell "gốc", cái đã được khởi chạy.
        // Chúng tôi không muốn có nhiều âm thanh từ "vỏ con" nhụy hoa hoặc bộ truyền phát.
        // Điều này có thể được phát hiện bởi sự hiện diện của một sao chổi.
        if (this.comet) {
            // Chia tỷ lệ âm thanh vụ nổ dựa trên kích thước vỏ hiện tại và kích thước vỏ (tối đa) đã chọn.
            // Bắn kích thước vỏ đã chọn sẽ luôn phát ra âm thanh giống nhau bất kể kích thước đã chọn,
            // nhưng khi các viên đạn nhỏ hơn được kích hoạt tự động, chúng sẽ phát ra âm thanh nhỏ hơn. Nó không có âm thanh tuyệt vời
            // khi một giá trị quá nhỏ được đưa ra, vì vậy thay vì dựa trên tỷ lệ, chúng ta chỉ
            // xem xét sự khác biệt về kích thước và ánh xạ nó tới một phạm vi được biết là âm thanh tốt.
            const maxDiff = 2;
            const sizeDifferenceFromMaxSize = Math.min(maxDiff, shellSizeSelector() - this.shellSize);
            const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7;
            soundManager.playSound('burst', soundScale);
        }
    }
}


const BurstFlash = {
    active: [],
    _pool: [],

    _new() {
        return {}
    },

    add(x, y, radius) {
        const instance = this._pool.pop() || this._new();

        instance.x = x;
        instance.y = y;
        instance.radius = radius;

        this.active.push(instance);
        return instance;
    },

    returnInstance(instance) {
        this._pool.push(instance);
    }
};


// Trình trợ giúp để tạo các đối tượng để lưu trữ các hạt hoạt động.
// Các hạt được lưu trữ trong các mảng được khóa theo màu (mã, không phải tên) để cải thiện hiệu suất kết xuất.
function createParticleCollection() {
    const collection = {};
    COLOR_CODES_W_INVIS.forEach(color => {
        collection[color] = [];
    });
    return collection;
}


// Thuộc tính sao (WIP)
// -----------------------
// transitionTime - quá trình chuyển đổi sao diễn ra gần đến cuối vòng đời

const Star = {
    drawWidth: 3,
    airDrag: 0.98,
    airDragHeavy: 0.992,
    active: createParticleCollection(),
    _pool: [],

    _new() {
        return {};
    },

    add(x, y, color, angle, speed, life, speedOffX, speedOffY) {
        const instance = this._pool.pop() || this._new();

        instance.visible = true;
        instance.heavy = false;
        instance.x = x;
        instance.y = y;
        instance.prevX = x;
        instance.prevY = y;
        instance.color = color;
        instance.speedX = Math.sin(angle) * speed + (speedOffX || 0);
        instance.speedY = Math.cos(angle) * speed + (speedOffY || 0);
        instance.life = life;
        instance.fullLife = life;
        instance.spinAngle = Math.random() * PI_2;
        instance.spinSpeed = 0.8;
        instance.spinRadius = 0;
        instance.sparkFreq = 0; // ms between spark emissions
        instance.sparkSpeed = 1;
        instance.sparkTimer = 0;
        instance.sparkColor = color;
        instance.sparkLife = 750;
        instance.sparkLifeVariation = 0.25;
        instance.strobe = false;

        this.active[color].push(instance);
        return instance;
    },

    // Phương thức công khai để dọn dẹp và trả lại một thể hiện cho nhóm.
    returnInstance(instance) {

    // Gọi trình xử lý onDeath nếu có (và chuyển phiên bản sao hiện tại)
        instance.onDeath && instance.onDeath(instance);
        // xóa
        instance.onDeath = null;
        instance.secondColor = null;
        instance.transitionTime = 0;
        instance.colorChanged = false;
        // Add back to the pool.
        this._pool.push(instance);
    }
};


const Spark = {
    drawWidth: 0,
    airDrag: 0.9,

    active: createParticleCollection(),
    _pool: [],

    _new() {
        return {};
    },

    add(x, y, color, angle, speed, life) {
        const instance = this._pool.pop() || this._new();

        instance.x = x;
        instance.y = y;
        instance.prevX = x;
        instance.prevY = y;
        instance.color = color;
        instance.speedX = Math.sin(angle) * speed;
        instance.speedY = Math.cos(angle) * speed;
        instance.life = life;

        this.active[color].push(instance);
        return instance;
    },

    returnInstance(instance) {
        // Add back to the pool.
        this._pool.push(instance);
    }
};


const soundManager = {
    baseURL: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/329180/',
    ctx: new (window.AudioContext || window.webkitAudioContext),
    sources: {
        lift: {
            volume: 1,
            playbackRateMin: 0.85,
            playbackRateMax: 0.95,
            fileNames: [
                'lift1.mp3',
                'lift2.mp3',
                'lift3.mp3'
            ]
        },
        burst: {
            volume: 1,
            playbackRateMin: 0.8,
            playbackRateMax: 0.9,
            fileNames: [
                'burst1.mp3',
                'burst2.mp3'
            ]
        },
        burstSmall: {
            volume: 0.25,
            playbackRateMin: 0.8,
            playbackRateMax: 1,
            fileNames: [
                'burst-sm-1.mp3',
                'burst-sm-2.mp3'
            ]
        },
        crackle: {
            volume: 0.2,
            playbackRateMin: 1,
            playbackRateMax: 1,
            fileNames: ['crackle1.mp3']
        },
        crackleSmall: {
            volume: 0.3,
            playbackRateMin: 1,
            playbackRateMax: 1,
            fileNames: ['crackle-sm-1.mp3']
        }
    },

    preload() {
        const allFilePromises = [];

        function checkStatus(response) {
            if (response.status >= 200 && response.status < 300) {
                return response;
            }
            const customError = new Error(response.statusText);
            customError.response = response;
            throw customError;
        }

        const types = Object.keys(this.sources);
        types.forEach(type => {
            const source = this.sources[type];
            const {fileNames} = source;
            const filePromises = [];
            fileNames.forEach(fileName => {
                const fileURL = this.baseURL + fileName;
                // Promise will resolve with decoded audio buffer.
                const promise = fetch(fileURL)
                    .then(checkStatus)
                    .then(response => response.arrayBuffer())
                    .then(data => new Promise(resolve => {
                        this.ctx.decodeAudioData(data, resolve);
                    }));

                filePromises.push(promise);
                allFilePromises.push(promise);
            });

            Promise.all(filePromises)
                .then(buffers => {
                    source.buffers = buffers;
                });
        });

        return Promise.all(allFilePromises);
    },

    pauseAll() {
        this.ctx.suspend();
    },

    resumeAll() {
        // Phát âm thanh không có âm lượng cho iOS. Điều này 'mở khóa' bối cảnh âm thanh khi người dùng bật âm thanh lần đầu tiên.
        this.playSound('lift', 0);
        // Chrome di động yêu cầu tương tác trước khi bắt đầu ngữ cảnh âm thanh.
        // Nút chuyển đổi âm thanh được kích hoạt trên 'touchstart', dường như không được tính là đầy đủ
        // tương tác với Chrome. Tôi đoán nó cần một cú nhấp chuột? Bằng mọi giá nếu điều đầu tiên người dùng làm
        // đang bật âm thanh, nó không hoạt động. Sử dụng setTimeout cho phép đăng ký tương tác đầu tiên.
        // Có lẽ giải pháp tốt hơn là theo dõi xem người dùng có tương tác hay không và nếu không thì họ thử bật
        // âm thanh, hiển thị chú giải công cụ mà họ cần nhấn lại để bật âm thanh.
        setTimeout(() => {
            this.ctx.resume();
        }, 250);
    },


// Thuộc tính riêng được sử dụng để điều chỉnh âm thanh bùng nổ nhỏ.
    _lastSmallBurstTime: 0,

    /**
     * Phát âm thanh của `type`. Sẽ chọn ngẫu nhiên một tệp được liên kết với loại và phát tệp đó ở âm lượng đã chỉ định
     * và tốc độ phát, với một chút thay đổi ngẫu nhiên về tốc độ phát. Tất cả điều này dựa trên cấu hình `nguồn`.
     *
     * @param {string} type - Loại âm thanh sẽ phát.
     * @param {?number} scale=1 - Giá trị từ 0 đến 1 (các giá trị nằm ngoài phạm vi sẽ bị kẹp). Cân ít hơn một
     * giảm âm lượng và tăng tốc độ phát lại. Điều này là do các vụ nổ lớn là
     * to hơn, sâu hơn và vang xa hơn những tiếng nổ nhỏ.
     * Lưu ý rằng thang điểm 0 sẽ tắt âm thanh.
     */
    playSound(type, scale = 1) {
        // Ensure `scale` is within valid range.
        scale = MyMath.clamp(scale, 0, 1);

        // Không cho phép bắt đầu âm thanh mới nếu âm thanh bị tắt, ứng dụng đang chạy chậm hoặc bị tạm dừng.
        // Kiểm tra chuyển động chậm có một số khoảng trống trong trường hợp người dùng không hoàn thành việc kéo thanh tốc độ
        // *tất cả về lại như cũ.
        if (!canPlaySoundSelector() || simSpeed < 0.95) {
            return;
        }

        // Điều tiết các đợt nổ nhỏ, vì tàn pháo rụng có rất nhiều vụ nổ.
        if (type === 'burstSmall') {
            const now = Date.now();
            if (now - this._lastSmallBurstTime < 20) {
                return;
            }
            this._lastSmallBurstTime = now;
        }

        const source = this.sources[type];

        if (!source) {
            throw new Error(`Sound of type "${type}" doesn't exist.`);
        }

        const initialVolume = source.volume;
        const initialPlaybackRate = MyMath.random(
            source.playbackRateMin,
            source.playbackRateMax
        );

        const scaledVolume = initialVolume * scale;
        // Tốc độ phát lại tăng theo quy mô. Đối với điều này, chúng tôi ánh xạ tỷ lệ 0-1 thành tỷ lệ 2-1.
        // Vì vậy, ở tỷ lệ 1, âm thanh phát bình thường, nhưng khi tỷ lệ tiến gần đến 0, tốc độ sẽ tăng gấp đôi.
        const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = scaledVolume;

        const buffer = MyMath.randomChoice(source.buffers);
        const bufferSource = this.ctx.createBufferSource();
        bufferSource.playbackRate.value = scaledPlaybackRate;
        bufferSource.buffer = buffer;
        bufferSource.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        bufferSource.start(0);
    }
};



// function setLoadingStatus(status) {
//     document.querySelector('.loading-init__status').textContent = status;
// }
if (IS_HEADER) {
    init();
} else {
// Cho phép hiển thị trạng thái, sau đó tải trước nội dung và khởi động ứng dụng.
//     setLoadingStatus('Pháo hoa đang được tải...');
    setTimeout(() => {
        soundManager.preload()
            .then(
                init,
                reason => {
                    init();

                    // setLoadingStatus('Error Loading Audio');
                    return Promise.reject(reason);
                }
            );
    }, 0);
}