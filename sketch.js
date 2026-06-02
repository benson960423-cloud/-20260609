let video;
let handPose;
let hands = [];
let targets = [];
let particles = [];

// 遊戲狀態控制
let gameState = "LOADING"; // LOADING, START, PLAYING, GAMEOVER
let score = 0;
let gameTimer = 30; // 30秒限時挑戰
let lastTimerCheck = 0;
let isModelReady = false;

function preload() {
  // 載入模型，並關閉內部自動偵測（以手動控制防卡死）
  handPose = ml5.handPose({ flipHorizontal: false }, () => {
    console.log("AI Model Loaded!");
    isModelReady = true;
  }); 
}

function setup() {
  createCanvas(800, 600);
  
  // 設定攝影機
  video = createCapture(VIDEO);
  video.size(800, 600);
  video.hide();
  
  // 初始生成目標物
  resetGame();
}

function draw() {
  background(5, 5, 13);
  
  // 核心：手動控制偵測，只有在模型與影片都好的時候，主動叫 AI 偵測當前這一影格
  if (isModelReady && video.elt.readyState >= 2) {
    handPose.detect(video, gotHands);
  }
  
  // 1. 繪製攝影機畫面 (水平翻轉處理鏡像)
  if (gameState === "PLAYING" || gameState === "START" || gameState === "GAMEOVER") {
    push();
    translate(width, 0);
    scale(-1, 1);
    if (video.elt.readyState >= 2) {
      image(video, 0, 0, width, height);
    }
    pop();
  }

  // 2. 疊加賽博朋克科技濾鏡
  drawSciFiFilter();

  // 3. 根據遊戲狀態控制畫面
  if (gameState === "LOADING") {
    drawLoadingScreen();
    if (isModelReady && video.elt.readyState >= 2) {
      gameState = "START";
    }
  } else if (gameState === "START") {
    drawStartScreen();
  } else if (gameState === "PLAYING") {
    runGameLogic();
  } else if (gameState === "GAMEOVER") {
    drawGameOverScreen();
  }
}

// ------ 取得偵測結果 ------
function gotHands(results) {
  // 如果 AI 有回傳結果，就更新 hands 陣列，否則清空
  if (results && results.length > 0) {
    hands = results;
  } else {
    hands = [];
  }
}

// ------ 遊戲核心邏輯 ------
function runGameLogic() {
  // 處理倒數計時
  if (millis() - lastTimerCheck >= 1000) {
    gameTimer--;
    lastTimerCheck = millis();
    if (gameTimer <= 0) {
      gameState = "GAMEOVER";
    }
  }

  // 更新與繪製粒子系統
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // 更新與繪製數據目標
  for (let target of targets) {
    target.update();
    target.display();
  }

  // 手部關鍵點骨架與互動邏輯 (嚴格防崩潰保護)
  if (hands && hands.length > 0 && hands[0] && hands[0].keypoints) {
    let hand = hands[0];
    
    // 檢查是否有抓到食指尖端(節點8)
    if (hand.keypoints.length > 8 && hand.keypoints[8]) {
      let indexFinger = hand.keypoints[8];
      
      if (indexFinger.x !== undefined && indexFinger.y !== undefined) {
        // 計算鏡像翻轉後的真實畫布座標
        let mappedX = width - indexFinger.x;
        let mappedY = indexFinger.y;

        // 繪製科技感手部準星
        drawCrosshair(mappedX, mappedY);

        // 碰撞偵測
        for (let i = targets.length - 1; i >= 0; i--) {
          let d = dist(mappedX, mappedY, targets[i].x, targets[i].y);
          if (d < targets[i].r + 15) {
            if (targets[i].type === "VIRUS") {
              createExplosion(targets[i].x, targets[i].y, color(0, 255, 200));
              score += 10;
            } else {
              createExplosion(targets[i].x, targets[i].y, color(255, 50, 50));
              score = max(0, score - 15);
            }
            targets.splice(i, 1);
            targets.push(new Target());
          }
        }
      }
    }
  }

  // 顯示頂部資訊 UI
  drawUI();
}

// ------ 遊戲初始化/重設 ------
function resetGame() {
  score = 0;
  gameTimer = 30;
  targets = [];
  particles = [];
  for (let i = 0; i < 4; i++) targets.push(new Target("VIRUS"));
  for (let i = 0; i < 2; i++) targets.push(new Target("CORE_DATA"));
}

function mousePressed() {
  if (gameState === "START") {
    resetGame();
    lastTimerCheck = millis();
    gameState = "PLAYING";
  } else if (gameState === "GAMEOVER") {
    gameState = "START";
  }
}

function drawSciFiFilter() {
  fill(0, 20, 40, 50);
  noStroke();
  rect(0, 0, width, height);

  stroke(0, 255, 255, 20);
  strokeWeight(1);
  for (let i = 0; i < height; i += 5) {
    line(0, i, width, i);
  }
}

function drawCrosshair(x, y) {
  push();
  noFill();
  stroke(0, 255, 255, 200);
  strokeWeight(2);
  ellipse(x, y, 35, 35);
  ellipse(x, y, 5, 5);
  
  stroke(0, 255, 255, 150);
  line(x - 25, y, x - 10, y);
  line(x + 10, y, x + 25, y);
  line(x, y - 25, x, y - 10);
  line(x, y + 10, x, y + 25);
  pop();
}

function drawUI() {
  push();
  textFont('Courier New');
  textSize(22);
  
  // 數據得分
  fill(0, 255, 255);
  text(`DATA PURGED: ${score}`, 20, 40);
  
  // 倒數計時
  if (gameTimer <= 5) fill(255, 50, 50); 
  else fill(255, 255, 0);
  text(`SEC_TIMER: ${gameTimer}s`, width - 220, 40);
  
  // 偵測狀態回報
  if (hands && hands.length > 0) {
    fill(0, 255, 100);
    text(`HAND DETECTED: ACTIVE`, 20, 75);
  } else {
    fill(255, 150, 0);
    text(`HAND DETECTED: SEARCHING...`, 20, 75);
  }
  pop();
}

function drawLoadingScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  fill(0, 255, 255);
  textSize(32);
  text("INITIALIZING AI MODELS...", width/2, height/2 - 30);
  textSize(16);
  fill(0, 255, 255, 150);
  text("Connecting via Phone Camera QR Link & Loading ml5.js...", width/2, height/2 + 20);
  pop();
}

function drawStartScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  fill(0, 255, 255);
  textSize(45);
  text("CYBER-TRACE: DATA PURGE", width/2, height/2 - 80);
  
  fill(255, 255, 255, 200);
  textSize(18);
  text("駕馭數據、人機協作，以洞察與倫理贏戰 AI 新時代！", width/2, height/2 - 20);
  
  fill(0, 255, 150);
  textSize(16);
  text("【玩法指導】", width/2, height/2 + 40);
  fill(255, 255, 255);
  text("1. 移動食指瞄準 🔴 紅色惡意雜訊 進行淨化 (+10)", width/2, height/2 + 70);
  fill(255, 100, 100);
  text("2. 警告：切勿觸碰 🔵 核心敏感數據 (-15)", width/2, height/2 + 100);
  
  fill(0, 255, 255, sin(frameCount * 0.1) * 150 + 100);
  textSize(22);
  text(">> CLICK CANVAS TO START WORK <<", width/2, height/2 + 170);
  pop();
}

function drawGameOverScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  fill(255, 50, 50);
  textSize(50);
  text("PURGE COMPLETE", width/2, height/2 - 50);
  
  fill(255, 255, 255);
  textSize(28);
  text(`FINAL SCORE: ${score}`, width/2, height/2 + 20);
  
  fill(0, 255, 255);
  textSize(16);
  text(">> CLICK TO REBOOT SYSTEM <<", width/2, height/2 + 100);
  pop();
}

class Target {
  constructor(type) {
    this.x = random(50, width - 50);
    this.y = random(50, height - 50);
    this.r = 20;
    this.vx = random(-3, 3);
    this.vy = random(-3, 3);
    this.type = type || (random(1) > 0.35 ? "VIRUS" : "CORE_DATA");
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < this.r || this.x > width - this.r) this.vx *= -1;
    if (this.y < this.r || this.y > height - this.r) this.vy *= -1;
  }

  display() {
    push();
    translate(this.x, this.y);
    let pulse = sin(frameCount * 0.1) * 5; 
    
    if (this.type === "VIRUS") {
      fill(255, 50, 50, 180);
      stroke(255, 150, 150);
      strokeWeight(2);
      rectMode(CENTER);
      rect(0, 0, (this.r + pulse) * 2, (this.r + pulse) * 2);
      fill(0);
      rect(0, 0, this.r, this.r);
    } else {
      fill(0, 150, 255, 150);
      stroke(100, 200, 255);
      strokeWeight(2);
      ellipse(0, 0, (this.r + pulse) * 2);
      stroke(255);
      line(-this.r, 0, this.r, 0);
    }
    pop();
  }
}

class Particle {
  constructor(x, y, particleColor) {
    this.x = x;
    this.y = y;
    let angle = random(TWO_PI);
    let speed = random(2, 7);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.alpha = 255;
    this.c = particleColor;
    this.size = random(4, 9);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 8; 
  }

  display() {
    push();
    noStroke();
    fill(red(this.c), green(this.c), blue(this.c), this.alpha);
    ellipse(this.x, this.y, this.size);
    pop();
  }

  isDead() {
    return this.alpha <= 0;
  }
}

function createExplosion(x, y, particleColor) {
  for (let i = 0; i < 25; i++) {
    particles.push(new Particle(x, y, particleColor));
  }
}