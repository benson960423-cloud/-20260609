let video;
let handPose;
let hands = [];
let targets = [];
let particles = [];

let gameState = "LOADING"; 
let score = 0;
let gameTimer = 30; 
let lastTimerCheck = 0;
let isModelReady = false;

// 準星座標
let cursorX = 0;
let cursorY = 0;
let targetCursorX = 0;
let targetCursorY = 0;

// 用來計算影像與畫布的裁切比例
let sx = 0, sy = 0, sw = 0, sh = 0;

function preload() {
  handPose = ml5.handPose({ flipHorizontal: false }, () => {
    console.log("AI Model Loaded!");
    isModelReady = true;
  }); 
}

function setup() {
  // 直接抓取手機瀏覽器的 100% 寬高，填滿整個直式螢幕
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO, () => {
    console.log("Camera Ready!");
    handPose.detectStart(video, gotHands);
  });
  
  video.hide();
  
  // 初始化準星在正中央
  cursorX = targetCursorX = width / 2;
  cursorY = targetCursorY = height / 2;
  resetGame();
}

// 支援手機轉向或調整大小
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function gotHands(results) {
  hands = results;
  if (gameState === "LOADING" && isModelReady) {
    gameState = "START";
  }
}

function draw() {
  background(5, 5, 13);
  
  // 1. 精準影像裁切與繪製 (等同於 CSS 的 object-fit: cover)
  if (video.elt.readyState >= 2 && video.width > 0) {
    let vRatio = video.width / video.height;
    let cRatio = width / height;

    // 計算如何完美把鏡頭畫面塞滿直式螢幕，並得出裁切範圍 (sx, sy, sw, sh)
    if (vRatio > cRatio) {
      sh = video.height;
      sw = video.height * cRatio;
      sx = (video.width - sw) / 2;
      sy = 0;
    } else {
      sw = video.width;
      sh = video.width / cRatio;
      sx = 0;
      sy = (video.height - sh) / 2;
    }

    if (gameState === "PLAYING" || gameState === "START" || gameState === "GAMEOVER") {
      push();
      translate(width, 0);
      scale(-1, 1); // 鏡像翻轉
      // 只繪製裁切後的有效範圍
      image(video, 0, 0, width, height, sx, sy, sw, sh);
      pop();
    }
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
  if (millis() - lastTimerCheck >= 1000) {
    gameTimer--;
    lastTimerCheck = millis();
    if (gameTimer <= 0) gameState = "GAMEOVER";
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  for (let target of targets) {
    target.update();
    target.display();
  }

  // 2. 食指尖端絕對座標轉換 (解決準度偏離與超出邊界問題)
  try {
    if (hands && hands.length > 0) {
      let hand = hands[0];
      if (hand.keypoints && hand.keypoints.length > 8) {
        let indexFinger = hand.keypoints[8]; // 8 為食指尖
        
        if (typeof indexFinger.x === 'number' && typeof indexFinger.y === 'number' && sw > 0) {
          // 利用 p5 的 map 函數，將相機原始座標「精準映射」到你目前的螢幕範圍
          // 並且自動處理鏡像水平翻轉 (width 到 0)
          let mappedX = map(indexFinger.x, sx, sx + sw, width, 0);
          let mappedY = map(indexFinger.y, sy, sy + sh, 0, height);
          
          targetCursorX = mappedX;
          targetCursorY = mappedY;
        }
      }
    }
  } catch (error) {}

  // 3. 速度優化：將過渡係數從 0.4 拉高到 0.85，保留極微小的防抖，但幾乎零延遲！
  cursorX = lerp(cursorX, targetCursorX, 0.85); 
  cursorY = lerp(cursorY, targetCursorY, 0.85);

  drawCrosshair(cursorX, cursorY);

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
  // 重新調整標靶數量，手機直式螢幕不用太多
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

// ================= 以下為視覺與 UI =================

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
  stroke(0, 255, 255, 220);
  strokeWeight(3);
  ellipse(x, y, 35, 35);
  
  fill(0, 255, 255);
  noStroke();
  ellipse(x, y, 8, 8); // 紅心點
  
  stroke(0, 255, 255, 150);
  strokeWeight(2);
  line(x - 25, y, x - 12, y);
  line(x + 12, y, x + 25, y);
  line(x, y - 25, x, y - 12);
  line(x, y + 12, x, y + 25);
  pop();
}

function drawUI() {
  push();
  textFont('Courier New');
  textSize(22);
  
  fill(0, 255, 255);
  text(`SCORE: ${score}`, 20, 40);
  
  if (gameTimer <= 5) fill(255, 50, 50); 
  else fill(255, 255, 0);
  text(`TIME: ${gameTimer}s`, width - 140, 40);
  
  if (hands && hands.length > 0) {
    fill(0, 255, 100);
    text(`TRACK: OK`, 20, 70);
  } else {
    fill(255, 150, 0);
    text(`TRACK: LOST`, 20, 70);
  }
  pop();
}

function drawLoadingScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  fill(0, 255, 255);
  textSize(26);
  text("INITIALIZING...", width/2, height/2);
  textSize(16);
  text("AI System Loading", width/2, height/2 + 30);
  pop();
}

function drawStartScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  fill(0, 255, 255);
  textSize(40);
  text("DATA PURGE", width/2, height/2 - 100);
  
  fill(255, 255, 255);
  textSize(16);
  text("Point your INDEX FINGER to aim", width/2, height/2 - 30);
  
  fill(0, 255, 150);
  textSize(18);
  text("🔴 VIRUS (+10)", width/2, height/2 + 40);
  fill(255, 100, 100);
  text("🔵 CORE DATA (-15)", width/2, height/2 + 80);
  
  fill(0, 255, 255, sin(frameCount * 0.1) * 150 + 100);
  textSize(22);
  text(">> TAP TO START <<", width/2, height/2 + 160);
  pop();
}

function drawGameOverScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  
  fill(255, 50, 50);
  textSize(45);
  text("COMPLETE", width/2, height/2 - 60);
  
  fill(255, 255, 255);
  textSize(30);
  text(`SCORE: ${score}`, width/2, height/2 + 20);
  
  fill(0, 255, 255);
  textSize(18);
  text(">> TAP TO RESTART <<", width/2, height/2 + 100);
  pop();
}

class Target {
  constructor(type) {
    this.r = 30; // 手機版稍微加大標靶，更好瞄準
    // 限制生成範圍，絕對不會生在螢幕最邊緣讓你點不到
    this.x = random(this.r + 30, width - this.r - 30);
    this.y = random(this.r + 90, height - this.r - 30); 
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
    let pulse = sin(frameCount * 0.15) * 4; 
    
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
    let speed = random(4, 10);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.alpha = 255;
    this.c = particleColor;
    this.size = random(6, 14);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 12; 
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