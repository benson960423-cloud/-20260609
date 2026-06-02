let video;
let handPose;
let hands = [];
let targets = [];
let particles = [];

// 遊戲狀態控制
let gameState = "LOADING"; 
let score = 0;
let gameTimer = 30; 
let lastTimerCheck = 0;
let isModelReady = false;

function preload() {
  // 載入 AI 模型
  handPose = ml5.handPose({ flipHorizontal: false }, () => {
    console.log("AI Model Loaded Successfully!");
    isModelReady = true;
  }); 
}

function setup() {
  // 【關鍵修正 1】改成手機直向比例 (Portrait Mode)
  createCanvas(480, 640);
  
  // 設定攝影機，並在攝影機準備好後才啟動 AI 偵測
  video = createCapture(VIDEO, () => {
    console.log("Video Stream Ready!");
    handPose.detectStart(video, gotHands);
  });
  
  // 【關鍵修正 2】影片大小必須跟畫布完全一致，避免座標錯亂
  video.size(480, 640);
  video.hide();
  
  resetGame();
}

// 取得 AI 偵測結果
function gotHands(results) {
  hands = results;
  
  // 偵測到模型與畫面都正常時，解除 Loading
  if (gameState === "LOADING" && isModelReady) {
    gameState = "START";
  }
}

function draw() {
  background(5, 5, 13);
  
  // 繪製攝影機畫面 (水平翻轉處理鏡像)
  if (gameState === "PLAYING" || gameState === "START" || gameState === "GAMEOVER") {
    push();
    translate(width, 0);
    scale(-1, 1); // 鏡像翻轉
    if (video.elt.readyState >= 2) {
      image(video, 0, 0, width, height);
    }
    pop();
  }

  // 疊加賽博朋克科技濾鏡
  drawSciFiFilter();

  // 遊戲狀態切換
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
    if (gameTimer <= 0) {
      gameState = "GAMEOVER";
    }
  }

  // 繪製粒子特效
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // 繪製標靶
  for (let target of targets) {
    target.update();
    target.display();
  }

  // 【關鍵修正 3】絕對防禦機制 (Try-Catch) - 防止抓不到資料直接卡死
  try {
    if (hands && hands.length > 0) {
      let hand = hands[0];
      
      // 確認 keypoints 存在且陣列長度足夠 (8 是食指尖端)
      if (hand.keypoints && hand.keypoints.length > 8) {
        let indexFinger = hand.keypoints[8];
        
        // 確保 X 和 Y 座標是有效數字
        if (typeof indexFinger.x === 'number' && typeof indexFinger.y === 'number') {
          
          // 轉換座標 (與畫面鏡像翻轉對應)
          let mappedX = width - indexFinger.x;
          let mappedY = indexFinger.y;

          // 畫準星
          drawCrosshair(mappedX, mappedY);

          // 碰撞偵測
          for (let i = targets.length - 1; i >= 0; i--) {
            let d = dist(mappedX, mappedY, targets[i].x, targets[i].y);
            if (d < targets[i].r + 15) { // 碰到標靶
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
  } catch (error) {
    console.error("AI 辨識防呆攔截:", error);
    // 即使發生錯誤，遊戲畫面也不會卡死！
  }

  drawUI();
}

function resetGame() {
  score = 0;
  gameTimer = 30;
  targets = [];
  particles = [];
  for (let i = 0; i < 3; i++) targets.push(new Target("VIRUS")); // 直向畫面稍微減少標靶數量
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
  stroke(0, 255, 255, 255);
  strokeWeight(3);
  ellipse(x, y, 35, 35);
  fill(0, 255, 255);
  ellipse(x, y, 8, 8); // 準星中心加粗
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
  text(`TIME: ${gameTimer}s`, width - 130, 30);
  
  if (hands && hands.length > 0) {
    fill(0, 255, 100);
    text(`TRACKING: OK`, 15, 60);
  } else {
    fill(255, 150, 0);
    text(`TRACKING: LOST`, 15, 60);
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
  text("Please wait for camera & AI", width/2, height/2 + 30);
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
  text("Stand in front of the camera.", width/2, height/2 - 20);
  text("Use your INDEX FINGER to play.", width/2, height/2 + 5);
  
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
    this.r = 20;
    this.x = random(this.r + 10, width - this.r - 10);
    this.y = random(this.r + 50, height - this.r - 10); // 避開頂部 UI
    this.vx = random(-2.5, 2.5);
    this.vy = random(-2.5, 2.5);
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