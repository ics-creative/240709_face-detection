import * as THREE from 'three';

// グローバルな変数定義
let currentDeco = 'rabbit'; // デフォルトのスタンプ
const decoLoadedImage = {}; // スタンプ画像を格納するオブジェクト
const decoImageRatios = {}; // 画像の縦横比を格納するオブジェクト
const decoImageList = ['hige', 'ribbon', 'rabbit', 'cat02', 'cat03', 'bear01']; // スタンプ画像のリスト
// スタンプ画像を切り替えるボタン
const buttonElements = document.querySelectorAll('.button');
// スタンプ画像の位置を修正するためのボタン
const positionButtonElements = document.querySelectorAll('.position-controllerButton');

const canvasEl = document.querySelector('#canvas');
const videoEl = document.querySelector('#video');
const videoWidth = 640;
const videoHeight = 480;
let decoMesh;
let detector;
let results; // 検出した顔のリスト
let faceNormalVector;

let positionX = 0;
let positionY = 0;

let scene, camera, renderer;

// スタンプごとの設定
const decoSettings = {
  hige: { scale: 30, basePoint: 164, xFix: 5, yFix: -20 },
  rabbit: { scale: 280, basePoint: 1, xFix: 5, yFix: -30 },
  ribbon: { scale: 70, basePoint: 0, xFix: 5, yFix: -5 },
  cat02: { scale: 210, basePoint: 1, xFix: 5, yFix: -20 },
  cat03: { scale: 190, basePoint: 1, xFix: 0, yFix: 0 },
  bear01: { scale: 180, basePoint: 1, xFix: 0, yFix: 0 }
};

// Three.jsの初期設定を行う関数
function setupTHREE() {
  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    alpha: true // Canvasの背景を透明にするために設定
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(videoWidth, videoHeight);
  renderer.setClearColor(0x000000, 0);

  // シーンを作成
  scene = new THREE.Scene();

  // カメラを作成
  const fov = 45;
  camera = new THREE.PerspectiveCamera(fov, videoWidth / videoHeight, 1, 1000);
  camera.position.set(0, 0, 680); // zの値は手動調整

  createDecoPlane();
}

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
      updateDecoPlane();
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
        positionX -= 5;
      } else if (position === 'left') {
        positionX += 5;
      }
    });
  });
}

// スタンプ画像をロードする関数
function loadDecoImages() {
  let imagesLoaded = 0;
  decoImageList.forEach((name) => {
    const img = new Image();
    img.onload = () => {
      decoLoadedImage[name] = img;
      decoImageRatios[name] = img.width / img.height;
      imagesLoaded++;
      if (imagesLoaded === decoImageList.length) {
        setupTHREE(); // 全てのスタンプ画像がロードされたらThree.jsのセットアップを行う
      }
    };
    img.src = `images/${name}.png`;
  });
}

// スタンプのために使うプレーンを作成
function createDecoPlane() {
  const settings = decoSettings[currentDeco];
  const ratio = decoImageRatios[currentDeco];
  const geometry = new THREE.PlaneGeometry(ratio, 1); // 縦横比を設定してジオメトリを作成
  const loader = new THREE.TextureLoader();
  const texture = loader.load(`images/${currentDeco}.png`, function(map) {
    map.colorSpace = THREE.SRGBColorSpace;
  });

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true
  });

  decoMesh = new THREE.Mesh(geometry, material);
  decoMesh.scale.set(settings.scale, settings.scale, 0); // ここでサイズを調整する

  scene.add(decoMesh);
}

// スタンププレーンを更新する関数
function updateDecoPlane() {
  // 既存のメッシュを削除
  if (decoMesh) {
    scene.remove(decoMesh);
    decoMesh.geometry.dispose();
    decoMesh.material.dispose();
    decoMesh = null;
  }
  // 新しいメッシュを作成
  createDecoPlane();
}

// スタンプのためのプレーンの位置と回転、スケールを更新
function updateDecoMesh() {
  if (!results || results.length === 0) {
    return;
  }
  const quaternion = calcNormalVector(); // 顔の向きのベクトル（法線ベクトル）から回転を計算
  decoMesh.quaternion.copy(quaternion); // 向きを合わせる

  const settings = decoSettings[currentDeco];
  const fixData = fixLandmarkValue(results[0].keypoints); // Three.jsで使える座標にする
  const basePoint = fixData[settings.basePoint];

  // スマホのインカメラを使用しているかを判定
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
  const isFrontCamera = videoEl.srcObject.getTracks()[0].getSettings().facingMode === 'user';
  const zOffset = isMobile && isFrontCamera ? 300 : 100;

  const faceCenter = new THREE.Vector3(
    basePoint.x + positionX + settings.xFix,
    basePoint.y + positionY + settings.yFix,
    basePoint.z - zOffset,
  );

  const noseTip = fixData[1];  // インデックス1が鼻の中央に対応
  const rightEar = fixData[127]; // インデックス127が右耳に対応
  const leftEar = fixData[356];  // インデックス356が左耳に対応

  // 顔の傾きを計算する
  const dx = rightEar.x - leftEar.x;
  const dy = rightEar.y - leftEar.y;
  const angle = Math.atan2(dy, dx);

  // 鼻の中央から左右の耳までの距離を計算する
  const distanceToRightEar = Math.hypot((noseTip.x - rightEar.x), (noseTip.y - rightEar.y));
  const distanceToLeftEar = Math.hypot((noseTip.x - leftEar.x), (noseTip.y - leftEar.y));
  const earDistanceSum = distanceToRightEar + distanceToLeftEar;
  const baseEarDistanceSum = 200; // 基準となる鼻の中央から左右の耳までの距離の絶対値の合計

  // 鼻の中央から左右の耳までの距離の絶対値の合計に基づいてスケールを計算する（横向いたときに画像が小さくならないように）
  const scale = earDistanceSum / baseEarDistanceSum;

  decoMesh.scale.set(settings.scale * scale, -settings.scale * scale, 0); // スケールを適用

  // 画像の高さの半分を計算して、Y軸の位置を調整
  const imageHeight = settings.scale * scale; // PlaneGeometryの高さ * スケール
  faceCenter.y += imageHeight / 2; // 高さの半分をY軸に加算

  // 画像の回転中心を画像の中心に設定するため、X軸およびY軸方向のずれを調整
  const offsetX = imageHeight / 2 * Math.sin(angle); // 回転に伴うX方向のずれを計算
  faceCenter.x += offsetX; // X方向のずれを調整
  faceCenter.y -= offsetX * Math.sin(angle); // Y方向のずれを調整

  decoMesh.position.copy(faceCenter);

  decoMesh.rotation.z = angle; // 画像を回転
}

// 顔の傾きを求める関数
function calcNormalVector() {
  if (!results || results.length === 0) {
    return;
  }

  // 顔のキーポイントデータを取得し、Three.jsで使用できる座標に変換
  const fixData = fixLandmarkValue(results[0].keypoints);
  const noseTip = fixData[1]; // 鼻の先端のキーポイント
  const leftNose = fixData[279]; // 鼻の左端のキーポイント
  const rightNose = fixData[49]; // 鼻の右端のキーポイント

  // 鼻の左端と右端の中間点を計算
  const midpoint = {
    x: (leftNose.x + rightNose.x) / 2,
    y: (leftNose.y + rightNose.y) / 2,
    z: (leftNose.z + rightNose.z) / 2,
  };

  // 中間点から垂直方向に少し上の点を定義
  const perpendicularUp = {
    x: midpoint.x,
    y: midpoint.y - 10,
    z: midpoint.z,
  };

  // 垂直方向に上の点（perpendicularUp）から鼻の先端（noseTip）までのベクトルを計算し、正規化して法線ベクトルを取得
  faceNormalVector = new THREE.Vector3(noseTip.x, noseTip.y, noseTip.z)
    .sub(new THREE.Vector3(perpendicularUp.x, perpendicularUp.y, perpendicularUp.z))
    .normalize();

  // 法線ベクトルを基にクォータニオンを作成（Z軸から法線ベクトルへの回転を表す）
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceNormalVector);

  return quaternion;
}

// ウェブカメラを有効にする関数
async function enableWebcam() {
  const constraints = {
    video: {
      width: videoWidth,
      height: videoHeight,
      facingMode: 'user', // スマホのフロントカメラを使用
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;

    return new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        resolve(videoEl);
      };
    });
  } catch (error) {
    console.error('Error accessing webcam: ', error);
    alert('カメラのアクセスに失敗しました。カメラのアクセス権限を確認してください。');
  }
}

// モデルをセットアップする関数
async function setupModel() {
  const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'
  };
  detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
}

// 顔を検知する関数。render内で実行する
async function detectFace() {
  const estimationConfig = { flipHorizontal: false };
  results = await detector.estimateFaces(videoEl, estimationConfig);
}

// face-landmark-detectionから取得したデータをThree.jsで扱いやすくするための関数
function fixLandmarkValue(data) {
  const depthStrength = 100;

  return data.map((el) => {
    return {
      x: el.x - videoEl.videoWidth / 2,
      y: -el.y + videoEl.videoHeight / 2,
      z: ((el.z / 100) * -1 + 1) * depthStrength
    };
  });
}

//　毎フレーム走らせる処理
async function render() {
  await detectFace(); // 顔を検知する
  updateDecoMesh(); // スタンプ用のメッシュを更新

  renderer.render(scene, camera);
  requestAnimationFrame(render); // 毎フレームレンダリングを呼び出す
}

// 初期化関数
async function init() {
  addEventListeners(); // イベントリスナーを追加
  loadDecoImages(); // スタンプ画像の読み込みと縦横比の取得
  await enableWebcam(); // ウェブカメラの準備が整うのを待つ
  await setupModel(); // モデルのセットアップ
  render(); // 毎フレームレンダリングを呼び出す
}

// 初期化関数を呼び出す
init();
