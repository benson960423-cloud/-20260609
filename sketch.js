let video;
let handPose;
let hands = [];
let targets = [];
let particles = [];

// 遊戲狀態與計時
let gameState = "LOADING"; 
let score = 0;
let gameTimer = 30; 
let lastTimerCheck = 0;
let isModelReady = false;

// 【新增】平滑追蹤準星 (防手抖)
let cursorX = 240;
let cursorY = 320;
let targetCursorX = 240;
let targetCursorY = 320;

function preload() {
  handPose = ml5.handPose({ flipHorizontal: false }, () => {
    console.log("AI Model Loaded!");
    isModelReady = true;
  }); 
}

function setup() {
  createCanvas(480, 640);
  
  // 【關鍵修正 1】強制要求手機硬體提供「直向 (Portrait)」及「前置鏡頭」影像
  let constraints = {
    video: {
      facingMode: "user",
      width: { ideal: 480 },
      height: { ideal: 640 }
    }
  };
  
  video = createCapture(constraints, () => {
    console.log("Mobile Camera Ready!");
    handPose.detectStart(video, gotHands);
  });
  
  video.size(480, 640);
  video.hide();
  
  resetGame();
}

function gotHands(results) {
  hands = results;
  if (gameState === "LOADING" && isModelReady) {
    gameState = "START";
  }
}

function draw() {
  background(5, 5, 13);
  
  // 攝影機畫面處理
  if (gameState === "PLAYING" || gameState === "START" || gameState === "GAMEOVER") {
    push();
    translate(width, 0);
    scale(-1, 1); 
    if (video.elt.readyState >= 2) {
      // 確保影像填滿 480x640，解決座標錯位問題
      image(video, 0, 0, width, height, 0, 0, video.width, video.height);
    }
    pop();
  }

  drawSciFiFilter();

  if (gameState === "LOADING") {
    drawLoadingScreen();
  } else if (gameState === "START") {
    drawStartScreen();
  } else if (gameState === "PLAYING") {
    runGameLogic();
  } else if (gameState === "GAMEOVER") {
    drawGameOverScreen();
  }
}

function runGameLogic() {
  // 計時器
  if (millis() - lastTimerCheck >= 1000) {
    gameTimer--;
    lastTimerCheck = millis();
    if (gameTimer <= 0) gameState = "GAMEOVER";
  }

  // 繪製粒子與標靶
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  for (let target of targets) {
    target.update();
    target.display();
  }

  // 【關鍵修正 2】單獨食指尖端精準擷取
  try {
    if (hands && hands.length > 0) {
      let hand = hands[0];
      
      // 8 代表食指尖端 (Index Finger Tip)
      if (hand.keypoints && hand.keypoints.length > 8) {
        let indexFinger = hand.keypoints[8];
        
        if (typeof indexFinger.x === 'number' && typeof indexFinger.y === 'number') {
          // 取得最新座標 (翻轉鏡像)
          targetCursorX = width - indexFinger.x;
          targetCursorY = indexFinger.y;
        }
      }
    }
  } catch (error) {
    // 默默吞下錯誤，確保不卡死
  }

  // 【關鍵修正 3】Lerp 平滑過渡技術：讓準星滑順地跟隨手指，去除抖動感！
  cursorX = lerp(cursorX, targetCursorX, 0.4); 
  cursorY = lerp(cursorY, targetCursorY, 0.4);

  // 繪製滑順版食指準星
  drawCrosshair(cursorX, cursorY);

  // 碰撞偵測 (使用平滑後的 cursor 座標)
  for (let i = targets.length - 1; i >= 0; i--) {
    let d = dist(cursorX, cursorY, targets[i].x, targets[i].y);
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

  drawUI();
}

function resetGame() {
  score = 0;
  gameTimer = 30;
  targets = [];
  particles = [];
  // 重置準星到畫面中央
  cursorX = width/2;
  cursorY = height/2;
  targetCursorX = width/2;
  targetCursorY = height/2;
  
  for (let i = 0; i < 3; i++) targets.push(new Target("VIRUS")); 
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

// ================= 以下為視覺與 UI 類別 =================

function drawSciFiFilter() {
  fill(0, 20, 40, 50);
  noStroke();
  rect(0, 0, width, height);
  stroke(0, 255, 255, 20);
  strokeWeight(1);
  for (let i = 0; i < height; i += 4) {
    line(0, i, width, i);
  }
}

function drawCrosshair(x, y) {
  push();
  noFill();
  // 準星外圈
  stroke(0, 255, 255, 200);
  strokeWeight(3);
  ellipse(x, y, 40, 40);
  
  // 準星中心實心點 (代表食指確切位置)
  fill(0, 255, 255);
  noStroke();
  ellipse(x, y, 10, 10);
  
  // 十字瞄準線
  stroke(0, 255, 255, 150);
  strokeWeight(2);
  line(x - 30, y, x - 15, y);
  line(x + 15, y, x + 30, y);
  line(x, y - 30, x, y - 15);
  line(x, y + 15, x, y + 30);
  pop();
}

function drawUI() {
  push();
  textFont('Courier New');
  textSize(20);
  
  fill(0, 255, 255);
  text(`SCORE: ${score}`, 15, 30);
  
  if (gameTimer <= 5) fill(255, 50, 50); 
  else fill(255, 255, 0);
  text(`TIME: ${gameTimer}s`, width - 120, 30);
  
  // 只要手有在鏡頭內，就會顯示 OK
  if (hands && hands.length > 0) {
    fill(0, 255, 100);
    text(`FINGER: TRACKING`, 15, 60);
  } else {
    fill(255, 150, 0);
    text(`FINGER: LOST`, 15, 60);
  }
  pop();
}

function drawLoadingScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  fill(0, 255, 255);
  textSize(24);
  text("INITIALIZING...", width/2, height/2);
  textSize(14);
  text("Waiting for Camera & AI", width/2, height/2 + 30);
  pop();
}

function drawStartScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  fill(0, 255, 255);
  textSize(35);
  text("DATA PURGE", width/2, height/2 - 80);
  
  fill(255, 255, 255);
  textSize(14);
  text("Point your INDEX FINGER to play", width/2, height/2 - 20);
  
  fill(0, 255, 150);
  text("🔴 Hit RED (+10)", width/2, height/2 + 50);
  fill(255, 100, 100);
  text("🔵 Avoid BLUE (-15)", width/2, height/2 + 80);
  
  fill(0, 255, 255, sin(frameCount * 0.1) * 150 + 100);
  textSize(18);
  text(">> TAP TO START <<", width/2, height/2 + 150);
  pop();
}

function drawGameOverScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  fill(255, 50, 50);
  textSize(40);
  text("COMPLETE", width/2, height/2 - 50);
  
  fill(255, 255, 255);
  textSize(28);
  text(`SCORE: ${score}`, width/2, height/2 + 20);
  
  fill(0, 255, 255);
  textSize(16);
  text(">> TAP TO RESTART <<", width/2, height/2 + 100);
  pop();
}

class Target {
  constructor(type) {
    this.r = 25; // 稍微加大一點判定範圍，手機上更好點擊
    // 確保標靶只會在安全的螢幕範圍內生成，不會躲在最邊邊
    this.x = random(this.r + 20, width - this.r - 20);
    this.y = random(this.r + 80, height - this.r - 20); 
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
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
    let pulse = sin(frameCount * 0.1) * 3; 
    
    if (this.type === "VIRUS") {
      fill(255, 50, 50, 200);
      stroke(255, 150, 150);
      strokeWeight(2);
      rectMode(CENTER);
      rect(0, 0, (this.r + pulse) * 2, (this.r + pulse) * 2);
    } else {
      fill(0, 150, 255, 200);
      stroke(100, 200, 255);
      strokeWeight(2);
      ellipse(0, 0, (this.r + pulse) * 2);
    }
    pop();
  }
}

class Particle {
  constructor(x, y, particleColor) {
    this.x = x;
    this.y = y;
    let angle = random(TWO_PI);
    let speed = random(3, 8);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.alpha = 255;
    this.c = particleColor;
    this.size = random(5, 12);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 10; 
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
  for (let i = 0; i < 20; i++) {
    particles.push(new Particle(x, y, particleColor));
  }
}