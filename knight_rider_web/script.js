document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('car-canvas');
    const ctx = canvas.getContext('2d');
    const btnPower = document.getElementById('btn-power');
    const btnSound = document.getElementById('btn-sound');
    const statusText = document.getElementById('status-text');

    let isRunning = false;
    let isSoundOn = false;
    let animationId = null;

    // Audio Context
    let audioCtx;
    let oscillator;
    let gainNode;
    let lfo;
    let lfoGain;

    // 3D Engine Variables
    let angleY = Math.PI / 4; // Start at 45 degrees
    const fov = 400;
    
    // Scanner Logic
    let scannerPos = 0;
    let scannerDir = 1;
    const scannerSpeed = 0.15;

    // Define the Car Model (Vertices and Edges)
    // Coordinate system: X (width), Y (height, negative is up), Z (length, positive is front)
    const vertices = [
        // Nose / Front Bumper
        {x: -35, y: 10, z: 110},  // 0: Front Left Bottom
        {x: 35, y: 10, z: 110},   // 1: Front Right Bottom
        {x: -35, y: 0, z: 110},   // 2: Front Left Top
        {x: 35, y: 0, z: 110},    // 3: Front Right Top
        
        // Hood Start / Wheel Well Front
        {x: -38, y: 10, z: 80},   // 4
        {x: 38, y: 10, z: 80},    // 5
        {x: -38, y: -5, z: 80},   // 6: Hood Front Left
        {x: 38, y: -5, z: 80},    // 7: Hood Front Right

        // Windshield Base
        {x: -38, y: -8, z: 30},   // 8
        {x: 38, y: -8, z: 30},    // 9

        // Roof Front
        {x: -30, y: -25, z: 10},  // 10
        {x: 30, y: -25, z: 10},   // 11

        // Roof Back
        {x: -30, y: -25, z: -20}, // 12
        {x: 30, y: -25, z: -20},  // 13

        // Rear Window Base / Deck
        {x: -38, y: -8, z: -40},  // 14
        {x: 38, y: -8, z: -40},   // 15

        // Rear Bumper Top
        {x: -38, y: 0, z: -90},   // 16
        {x: 38, y: 0, z: -90},    // 17

        // Rear Bumper Bottom
        {x: -38, y: 10, z: -90},  // 18
        {x: 38, y: 10, z: -90},   // 19

        // Side Skirts (Bottom Line)
        {x: -38, y: 15, z: 80},   // 20: Front Wheel Well Back Bottom
        {x: 38, y: 15, z: 80},    // 21
        {x: -38, y: 15, z: -40},  // 22: Rear Wheel Well Front Bottom
        {x: 38, y: 15, z: -40},   // 23
    ];

    const edges = [
        // Front Face
        [0, 1], [2, 3], [0, 2], [1, 3],
        // Nose to Hood
        [0, 4], [1, 5], [2, 6], [3, 7],
        // Hood
        [6, 7], [6, 8], [7, 9],
        // Windshield
        [8, 9], [8, 10], [9, 11], [10, 11],
        // Roof
        [10, 12], [11, 13], [12, 13],
        // Rear Window
        [12, 14], [13, 15], [14, 15],
        // Rear Deck
        [14, 16], [15, 17], [16, 17],
        // Rear Face
        [16, 18], [17, 19], [18, 19],
        // Side Lines (Top)
        [4, 20], [5, 21], // Wheel well front vertical
        [20, 22], [21, 23], // Side skirt
        [22, 18], [23, 19], // Rear wheel well
        [4, 6], [5, 7], // Connect side to hood
        [8, 14], [9, 15], // Beltline
        [6, 8], [7, 9], // Hood side
        [14, 16], [15, 17], // Rear deck side
        [16, 18], [17, 19] // Rear bumper side
    ];

    function project(p) {
        // Rotate around Y axis
        const cos = Math.cos(angleY);
        const sin = Math.sin(angleY);
        
        const x = p.x * cos - p.z * sin;
        const z = p.z * cos + p.x * sin;
        const y = p.y;

        // Perspective projection
        // Move camera back
        const scale = fov / (fov + z + 300); 
        
        return {
            x: x * scale + canvas.width / 2,
            y: y * scale + canvas.height / 2 + 50, // Offset down
            scale: scale
        };
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw Grid (Ground)
        ctx.strokeStyle = '#003300';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let z = -200; z <= 200; z+=40) {
            const p1 = project({x: -200, y: 20, z: z});
            const p2 = project({x: 200, y: 20, z: z});
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }
        for(let x = -200; x <= 200; x+=40) {
            const p1 = project({x: x, y: 20, z: -200});
            const p2 = project({x: x, y: 20, z: 200});
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();

        if (!isRunning) return;

        // Auto rotate slowly
        angleY += 0.005;

        // Draw Car Edges
        ctx.strokeStyle = '#00ff00'; // Classic terminal green
        ctx.lineWidth = 2;
        ctx.beginPath();
        edges.forEach(edge => {
            const p1 = project(vertices[edge[0]]);
            const p2 = project(vertices[edge[1]]);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        });
        ctx.stroke();

        // Draw Wheels (Simple Circles)
        drawWheel(-38, 15, 60); // Front Left
        drawWheel(38, 15, 60);  // Front Right
        drawWheel(-38, 15, -60); // Rear Left
        drawWheel(38, 15, -60);  // Rear Right

        // Draw Scanner
        drawScanner();

        animationId = requestAnimationFrame(draw);
    }

    function drawWheel(wx, wy, wz) {
        const segments = 8;
        const radius = 12;
        ctx.strokeStyle = '#00aa00';
        ctx.beginPath();
        for(let i=0; i<=segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const p = project({
                x: wx, 
                y: wy + Math.sin(theta) * radius, 
                z: wz + Math.cos(theta) * radius
            });
            if(i===0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }

    function drawScanner() {
        // Update scanner position
        scannerPos += scannerSpeed * scannerDir;
        if (scannerPos > 1 || scannerPos < -1) {
            scannerDir *= -1;
        }

        // Scanner is on the nose, between z=110, y=5 approx
        // Interpolate position between left and right of nose
        const leftX = -25;
        const rightX = 25;
        const y = 5;
        const z = 111; // Slightly in front

        // Calculate current light position
        const currentX = scannerPos * 25; // Range -25 to 25
        
        // Draw the main light
        const p1 = project({x: currentX - 4, y: y, z: z});
        const p2 = project({x: currentX + 4, y: y, z: z});

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw trail (fading lines)
        // Simple trail effect by drawing previous positions with lower opacity
        // For simplicity in 3D, we just draw the housing line in dark red
        const h1 = project({x: leftX, y: y, z: z});
        const h2 = project({x: rightX, y: y, z: z});
        
        ctx.strokeStyle = '#550000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h1.x, h1.y);
        ctx.lineTo(h2.x, h2.y);
        ctx.stroke();
    }

    // Audio Functions (Same as before)
    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
    }

    function startSound() {
        if (!audioCtx) initAudio();
        oscillator = audioCtx.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 120;
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;
        lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 1.5;
        lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        lfo.start();
        gainNode.gain.setTargetAtTime(0.2, audioCtx.currentTime, 0.1);
    }

    function stopSound() {
        if (gainNode) {
            gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
            setTimeout(() => {
                if (oscillator) oscillator.stop();
                if (lfo) lfo.stop();
            }, 200);
        }
    }

    function togglePower() {
        isRunning = !isRunning;
        
        if (isRunning) {
            btnPower.classList.add('active');
            btnPower.textContent = "SYSTEM ACTIVE";
            statusText.textContent = "ANALYZING VEHICLE GEOMETRY...";
            statusText.classList.add('active');
            draw(); // Start loop
            if (isSoundOn) startSound();
        } else {
            btnPower.classList.remove('active');
            btnPower.textContent = "POWER";
            statusText.textContent = "SYSTEM OFFLINE";
            statusText.classList.remove('active');
            cancelAnimationFrame(animationId);
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear screen
            stopSound();
        }
    }

    function toggleSound() {
        isSoundOn = !isSoundOn;
        if (isSoundOn) {
            btnSound.classList.add('active');
            if (isRunning) startSound();
        } else {
            btnSound.classList.remove('active');
            stopSound();
        }
    }

    btnPower.addEventListener('click', togglePower);
    btnSound.addEventListener('click', toggleSound);
    
    // Initial draw (grid only)
    draw();
});