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

let sx = 0, sy = 0, sw = 0, sh = 0;

function preload() {
  handPose = ml5.handPose({ flipHorizontal: false }, () => {
    console.log("AI Model Loaded!");
    isModelReady = true;
  }); 
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO, () => {
    console.log("Camera Ready!");
    handPose.detectStart(video, gotHands);
  });
  video.hide();
  
  cursorX = targetCursorX = width / 2;
  cursorY = targetCursorY = height / 2;
  resetGame();
}

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
  
  if (video.elt.readyState >= 2 && video.width > 0) {
    let vRatio = video.width / video.height;
    let cRatio = width / height;

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
      scale(-1, 1); 
      image(video, 0, 0, width, height, sx, sy, sw, sh);
      pop();
    }
  }

  drawSciFiFilter();

  if (gameState === "LOADING") drawLoadingScreen();
  else if (gameState === "START") drawStartScreen();
  else if (gameState === "PLAYING") runGameLogic();
  else if (gameState === "GAMEOVER") drawGameOverScreen();
}

function runGameLogic() {
  if (millis() - lastTimerCheck >= 1000) {
    gameTimer--;
    lastTimerCheck = millis();
    if (gameTimer <= 0) gameState = "GAMEOVER";
  }

  // 繪製粒子特效
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  // 更新與繪製標靶
  for (let target of targets) {
    target.update();
    target.display();
  }

  // 【新增】標靶之間的物理碰撞彈開邏輯
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      let t1 = targets[i];
      let t2 = targets[j];
      let d = dist(t1.x, t1.y, t2.x, t2.y);
      let minDist = t1.r + t2.r + 5; // 加上 5px 緩衝區

      if (d < minDist) {
        // 交換速度 (反彈)
        let tempVx = t1.vx;
        let tempVy = t1.vy;
        t1.vx = t2.vx;
        t1.vy = t2.vy;
        t2.vx = tempVx;
        t2.vy = tempVy;

        // 推開防止卡在一起
        let overlap = (minDist - d) / 2;
        let dx = (t2.x - t1.x) / d;
        let dy = (t2.y - t1.y) / d;
        t1.x -= dx * (overlap + 1);
        t1.y -= dy * (overlap + 1);
        t2.x += dx * (overlap + 1);
        t2.y += dy * (overlap + 1);
      }
    }
  }

  // 食指指尖追蹤
  try {
    if (hands && hands.length > 0) {
      let hand = hands[0];
      if (hand.keypoints && hand.keypoints.length > 8) {
        let indexFinger = hand.keypoints[8]; 
        
        if (typeof indexFinger.x === 'number' && typeof indexFinger.y === 'number' && sw > 0) {
          targetCursorX = map(indexFinger.x, sx, sx + sw, width, 0);
          targetCursorY = map(indexFinger.y, sy, sy + sh, 0, height);
        }
      }
    }
  } catch (error) {}

  // 【優化】動態平滑追蹤防手抖：距離大時移動快，距離小時穩定不過濾微小雜訊
  let dCursor = dist(cursorX, cursorY, targetCursorX, targetCursorY);
  if (dCursor > 1.5) { // 忽略 1.5px 以下的鏡頭雜訊抖動
    let dynamicLerp = map(dCursor, 0, 100, 0.15, 0.8, true);
    cursorX = lerp(cursorX, targetCursorX, dynamicLerp); 
    cursorY = lerp(cursorY, targetCursorY, dynamicLerp);
  }

  drawCrosshair(cursorX, cursorY);

  // 射擊碰撞偵測
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

// ================= 以下為視覺與 UI (已全面中文化) =================

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
  ellipse(x, y, 6, 6); 
  
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
  textFont('sans-serif');
  textSize(18);
  textAlign(LEFT, TOP);
  
  fill(0, 255, 255);
  text(`淨化數據量: ${score}`, 20, 30);
  
  if (gameTimer <= 5) fill(255, 50, 50); 
  else fill(255, 255, 0);
  text(`倒數計時: ${gameTimer}s`, 20, 60);
  
  if (hands && hands.length > 0) {
    fill(0, 255, 100);
    text(`神經連結: 正常`, 20, 90);
  } else {
    fill(255, 150, 0);
    text(`神經連結: 尋找指尖中...`, 20, 90);
  }
  pop();
}

function drawLoadingScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('sans-serif');
  fill(0, 255, 255);
  textSize(28);
  text("系統初始化中...", width/2, height/2 - 20);
  textSize(14);
  fill(150, 255, 255);
  text("正在連結相機與 AI 視覺模組", width/2, height/2 + 20);
  pop();
}

function drawStartScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('sans-serif');
  
  fill(0, 255, 255);
  textSize(36);
  text("CYBER-TRACE", width/2, height/2 - 120);
  textSize(24);
  text("數據淨化", width/2, height/2 - 80);
  
  // 放回你設計的海報標語，強化主題感
  fill(255, 255, 255, 200);
  textSize(12);
  text("駕馭數據、人機協作，以洞察與倫理贏戰 AI 新時代！", width/2, height/2 - 40);
  
  fill(255, 255, 255);
  textSize(16);
  text("【 操作指南 】", width/2, height/2 + 20);
  text("伸出你的【食指】引導畫面準星", width/2, height/2 + 50);
  
  fill(255, 100, 100);
  textSize(16);
  text("🔴 淨化 惡意雜訊 [ERR] (+10)", width/2, height/2 + 90);
  fill(100, 200, 255);
  text("🔵 避開 系統核心 [SYS] (-15)", width/2, height/2 + 120);
  
  fill(0, 255, 255, sin(frameCount * 0.1) * 150 + 100);
  textSize(18);
  text(">> 點擊螢幕開始執行 <<", width/2, height/2 + 180);
  pop();
}

function drawGameOverScreen() {
  push();
  textAlign(CENTER, CENTER);
  textFont('sans-serif');
  
  fill(255, 50, 50);
  textSize(40);
  text("淨化程序結束", width/2, height/2 - 60);
  
  fill(255, 255, 255);
  textSize(26);
  text(`最終數據量: ${score}`, width/2, height/2 + 10);
  
  fill(0, 255, 255);
  textSize(16);
  text(">> 點擊螢幕重新啟動系統 <<", width/2, height/2 + 80);
  pop();
}

// ================= 科技風格粒子與標靶 =================

class Target {
  constructor(type) {
    this.r = 28; 
    this.x = random(this.r + 30, width - this.r - 30);
    this.y = random(this.r + 120, height - this.r - 30); // 避開頂部文字
    // 速度稍微調慢一點，讓手機遊玩體驗更好
    this.vx = random(-1.5, 1.5);
    this.vy = random(-1.5, 1.5);
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
      // 惡意病毒：紅色數位鑽石
      fill(50, 0, 0, 180);
      stroke(255, 50, 50);
      strokeWeight(2);
      beginShape();
      vertex(0, -this.r - pulse);
      vertex(this.r + pulse, 0);
      vertex(0, this.r + pulse);
      vertex(-this.r - pulse, 0);
      endShape(CLOSE);
      
      // 內部裝飾線條與文字
      stroke(255, 100, 100, 100);
      line(-this.r/2, -this.r/2, this.r/2, this.r/2);
      line(this.r/2, -this.r/2, -this.r/2, this.r/2);
      
      noStroke();
      fill(255, 150, 150);
      textSize(12);
      textAlign(CENTER, CENTER);
      textFont('Courier New');
      text("ERR", 0, 0);

    } else {
      // 系統核心：藍色防禦六角形
      fill(0, 40, 80, 180);
      stroke(0, 200, 255);
      strokeWeight(2);
      beginShape();
      for (let a = 0; a < TWO_PI; a += TWO_PI / 6) {
        let hx = cos(a) * (this.r + pulse);
        let hy = sin(a) * (this.r + pulse);
        vertex(hx, hy);
      }
      endShape(CLOSE);
      
      // 內部旋轉科技環與文字
      noFill();
      stroke(0, 255, 255, 150);
      strokeWeight(1);
      ellipse(0, 0, this.r * 1.2);
      
      noStroke();
      fill(100, 255, 255);
      textSize(12);
      textAlign(CENTER, CENTER);
      textFont('Courier New');
      text("SYS", 0, 0);
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
    this.size = random(4, 10);
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
    rectMode(CENTER);
    // 爆炸粒子改成方形，更有數位資料碎裂的感覺
    rect(this.x, this.y, this.size, this.size); 
    pop();
  }

  isDead() {
    return this.alpha <= 0;
  }
}

function createExplosion(x, y, particleColor) {
  for (let i = 0; i < 15; i++) {
    particles.push(new Particle(x, y, particleColor));
  }
}