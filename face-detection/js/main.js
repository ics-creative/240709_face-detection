// グローバルな変数定義
let detector;
let results;
let currentDeco = 'rabbit'; // 現在選択されているスタンプ
const decoLoadedImage = {}; // スタンプ画像を格納するオブジェクト
const decoImageList = ['hige', 'ribbon', 'rabbit', 'cat02', 'cat03', 'bear01']; // スタンプ画像のリスト
// スタンプ画像を切り替えるボタン
const buttonElements = document.querySelectorAll('.button');
// スタンプ画像の位置を修正するためのボタン
const positionButtonElements = document.querySelectorAll('.position-controllerButton');

let positionX = 0;
let positionY = 0;

const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasWrapperElement = document.getElementById('canvasWrapper');
const ctx = canvasElement.getContext('2d');

// イベントリスナーを追加する関数
function addEventListeners() {
  // 選択されたスタンプ画像に切り替える
  buttonElements.forEach((el) => {
    el.addEventListener('click', () => {
      // すべてのボタンからcurrentクラスを削除
      buttonElements.forEach(btn => btn.classList.remove('current'));

      // クリックされたボタンにcurrentクラスを追加
      el.classList.add('current');

      positionX = 0;
      positionY = 0;
      currentDeco = el.dataset.deco;
    });
  });

  // スタンプ画像の位置を修正する
  positionButtonElements.forEach((el) => {
    el.addEventListener('click', () => {
      const position = el.dataset.position;
      if (position === 'top') {
        positionY += 5;
      } else if (position === 'bottom') {
        positionY -= 5;
      } else if (position === 'right') {
        positionX += 5;
      } else if (position === 'left') {
        positionX -= 5;
      }
    });
  });
}

// ウェブカメラを有効にする関数
async function enableCam() {
  const constraints = {
    audio: false,
    video: true,
    width: 640,
    height: 480
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    webcamElement.srcObject = stream;

    return new Promise((resolve) => {
      webcamElement.onloadedmetadata = () => {
        webcamElement.play();
        resolve();
      };
    });
  } catch (error) {
    console.error('Error accessing webcam: ', error);
    alert('カメラのアクセスに失敗しました。カメラのアクセス権限を確認してください。');
  }
}

// Canvasの初期化関数
function initCanvas() {
  //Canvasの大きさをwebcamに合わせる
  canvasElement.width = webcamElement.videoWidth;
  canvasElement.height = webcamElement.videoHeight;

  canvasWrapperElement.style.width = `${webcamElement.videoWidth}px`;
  canvasWrapperElement.style.height = `${webcamElement.videoHeight}px`;
}

// Webcamの画像をCanvasに描画する関数
function drawWebCamToCanvas() {
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // キャンバスの水平反転を設定
  ctx.save(); // 現在の状態を保存
  ctx.scale(-1, 1); // 水平反転
  ctx.translate(-canvasElement.width, 0); // 座標を移動して反転を適用

  ctx.drawImage(
    webcamElement,
    0,
    0,
    webcamElement.videoWidth,
    webcamElement.videoHeight
  );

  ctx.restore(); // 反転を元に戻す
}

// 顔を検知するためのモデルを初期化する関数
async function createFaceDetector() {
  const model = faceDetection.SupportedModels.MediaPipeFaceDetector;

  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection'
    // or 'base/node_modules/@mediapipe/face_detection' in npm.
  };
  detector = await faceDetection.createDetector(model, detectorConfig);

  return new Promise((resolve) => {
    resolve(detector);
  });
}

// 顔を検知する関数
async function estimateFaces() {
  const estimationConfig = { flipHorizontal: false };

  results = await detector.estimateFaces(webcamElement, estimationConfig);
}

// スタンプ画像の位置を計算する関数
function calculateRelativePosition(baseX, baseY, referencePoint1, referencePoint2, offsetXRatio, offsetYRatio, angle) {
  const dx = referencePoint2.x - referencePoint1.x;
  const dy = referencePoint2.y - referencePoint1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const offsetX = distance * offsetXRatio;
  const offsetY = distance * offsetYRatio;

  return calculateAdjustedPosition(baseX, baseY, offsetX + positionX, offsetY + positionY, angle);
}
function calculateAdjustedPosition(baseX, baseY, offsetX, offsetY, angle) {
  const adjustedX = baseX + offsetX * Math.cos(angle) - offsetY * Math.sin(angle);
  const adjustedY = baseY + offsetX * Math.sin(angle) + offsetY * Math.cos(angle);
  return { x: adjustedX, y: adjustedY };
}

// Canvasにスタンプ画像を描画する関数
function drawCanvas() {
  if (!results || results.length === 0) return;
  results.forEach(result => {
    const { keypoints } = result;

    const noseTip = keypoints.find((keypoint) => keypoint.name === 'noseTip');
    const rightEye = keypoints.find((keypoint) => keypoint.name === 'rightEye');
    const leftEye = keypoints.find((keypoint) => keypoint.name === 'leftEye');
    const mouthCenter = keypoints.find(
      (keypoint) => keypoint.name === 'mouthCenter'
    );
    const rightEarTragion = keypoints.find(
      (keypoint) => keypoint.name === 'rightEarTragion'
    );
    const leftEarTragion = keypoints.find(
      (keypoint) => keypoint.name === 'leftEarTragion'
    );

    // 顔の傾きを計算する
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angle = Math.atan2(dy, dx);

    // 顔の幅を計算する（左右の耳の距離）
    const faceWidth = Math.hypot((rightEarTragion.x - leftEarTragion.x), (rightEarTragion.y - leftEarTragion.y));
    const baseFaceWidth = 200; // 基準となる顔の幅

    // スケールを計算する
    const scale = baseFaceWidth / faceWidth;

    if (currentDeco === 'hige') {
      const { x: adjustedX, y: adjustedY } =
        calculateRelativePosition(noseTip.x, noseTip.y, noseTip, mouthCenter, 0.15, -0.5, angle);
      drawDecoImage({
        image: decoLoadedImage.hige,
        x: adjustedX,
        y: adjustedY,
        scale: 4 * scale,
        angle: angle
      });
    } else if (currentDeco === 'rabbit') {
      const { x: adjustedX, y: adjustedY } =
        calculateRelativePosition(rightEye.x, rightEye.y, rightEye, noseTip, -0.6, 1, angle);
      drawDecoImage({
        image: decoLoadedImage.rabbit,
        x: adjustedX,
        y: adjustedY,
        scale: 3.2 * scale,
        angle: angle
      });
    } else if (currentDeco === 'ribbon') {
      const { x: adjustedX, y: adjustedY } =
        calculateRelativePosition(noseTip.x, noseTip.y, noseTip, mouthCenter, 0.3, 0.05, angle);
      drawDecoImage({
        image: decoLoadedImage.ribbon,
        x: adjustedX,
        y: adjustedY,
        scale: 3.5 * scale,
        angle: angle
      });
    } else if (currentDeco === 'cat02') {
      const { x: adjustedX, y: adjustedY } =
        calculateRelativePosition(rightEye.x, rightEye.y, rightEye, noseTip, -0.5, 0.3, angle);
      drawDecoImage({
        image: decoLoadedImage.cat02,
        x: adjustedX,
        y: adjustedY,
        scale: 3.5 * scale,
        angle: angle
      });
    } else if (currentDeco === 'cat03') {
      const { x: adjustedX, y: adjustedY } =
        calculateRelativePosition(rightEye.x, rightEye.y, rightEye, noseTip, -0.5, 0.8, angle);
      drawDecoImage({
        image: decoLoadedImage.cat03,
        x: adjustedX,
        y: adjustedY,
        scale: 3.5 * scale,
        angle: angle
      });
    } else if (currentDeco === 'bear01') {
      const { x: adjustedX, y: adjustedY } =
        calculateRelativePosition(rightEye.x, rightEye.y, rightEye, noseTip, -0.5, 0.75, angle);
      drawDecoImage({
        image: decoLoadedImage.bear01,
        x: adjustedX,
        y: adjustedY,
        scale: 3.5 * scale,
        angle: angle
      });
    }
  });
}

// スタンプ画像をロードする関数
function loadDecoImages() {
  decoImageList.forEach((name) => {
    const img = new Image();
    img.src = `images/${name}.png`;
    decoLoadedImage[name] = img;
  });
}

// スタンプ画像を描画する関数
function drawDecoImage({ image, x, y, scale = 1, xFix = 0, yFix = 0, angle = 0 }) {
  const flippedX = canvasElement.width - x;
  const dx = flippedX - image.width / scale / 2; // 画像の中心に合わせるための計算
  const dy = y - image.height / scale / 2; // 画像の中心に合わせるための計算

  ctx.save(); // 現在のキャンバス状態を保存
  ctx.translate(dx + xFix + image.width / scale / 2, dy + yFix + image.height / scale / 2); // 画像の中心に移動
  ctx.scale(-1, -1); // 反転
  ctx.rotate(-angle); // 画像を回転

  ctx.drawImage(
    image,
    -image.width / scale / 2,
    -image.height / scale / 2,
    image.width / scale,
    image.height / scale
  );
  ctx.restore(); // 回転前の状態に戻す
}

//　毎フレーム走らせる処理
async function render() {
  await estimateFaces(); // 顔を検知する
  drawWebCamToCanvas(); // Canvasにvideoを描画する
  drawCanvas(); // Canvasにやりたいことを描画する

  requestAnimationFrame(render); // 毎フレームレンダリングを呼び出す
}

// 初期化関数
async function init() {
  addEventListeners(); // イベントリスナーを追加
  loadDecoImages(); // スタンプ画像をロード
  await enableCam(); // ウェブカメラの起動
  await createFaceDetector(); // 顔検知モデルの初期化
  initCanvas(); // Canvasの初期化

  render(); // 毎フレーム走らせる処理
}

// 初期化関数を呼び出す
init();
