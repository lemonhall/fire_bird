document.addEventListener('DOMContentLoaded', () => {
    const scannerBar = document.getElementById('scanner-bar');
    const btnPower = document.getElementById('btn-power');
    const btnSound = document.getElementById('btn-sound');
    const statusText = document.getElementById('status-text');

    const NUM_LIGHTS = 16;
    const lights = [];
    
    // Initialize lights
    for (let i = 0; i < NUM_LIGHTS; i++) {
        const light = document.createElement('div');
        light.classList.add('light');
        scannerBar.appendChild(light);
        lights.push(light);
    }

    let isRunning = false;
    let isSoundOn = false;
    let animationId = null;
    
    // Scanner state
    let headPos = 0;
    let direction = 1; // 1 for right, -1 for left
    let speed = 0.25; // Lights per frame (approx)
    
    // Brightness array for trail effect
    let brightnessValues = new Array(NUM_LIGHTS).fill(0);

    // Audio Context
    let audioCtx;
    let oscillator;
    let gainNode;
    let lfo;
    let lfoGain;

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
    }

    function startSound() {
        if (!audioCtx) initAudio();
        
        // Main tone
        oscillator = audioCtx.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 120; // Base drone pitch

        // Volume control
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;

        // LFO for the "whoosh" effect (Amplitude Modulation)
        lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 1.5; // Speed of the scanner sound
        
        lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.3; // Depth of modulation

        // Connect: LFO -> LFO Gain -> Main Gain.gain
        // This modulates the volume
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);

        // Connect: Main Osc -> Main Gain -> Destination
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        lfo.start();

        // Fade in
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

    function updateScanner() {
        if (!isRunning) return;

        // Decay all lights
        for (let i = 0; i < NUM_LIGHTS; i++) {
            brightnessValues[i] *= 0.8; // Trail decay factor
        }

        // Move head
        headPos += speed * direction;

        // Bounce logic
        if (headPos >= NUM_LIGHTS - 1) {
            headPos = NUM_LIGHTS - 1;
            direction = -1;
        } else if (headPos <= 0) {
            headPos = 0;
            direction = 1;
        }

        // Light up the current head position (and neighbors for smoothness)
        const index = Math.round(headPos);
        if (index >= 0 && index < NUM_LIGHTS) {
            brightnessValues[index] = 1.0;
        }

        // Apply styles
        lights.forEach((light, i) => {
            const brightness = brightnessValues[i];
            if (brightness > 0.05) {
                // Red color with varying opacity/lightness
                // Using box-shadow for the glow effect
                const alpha = brightness;
                const glowSize = brightness * 20;
                
                light.style.backgroundColor = `rgba(255, 0, 0, ${alpha})`;
                light.style.boxShadow = `0 0 ${glowSize}px rgba(255, 0, 0, ${alpha})`;
                light.style.zIndex = Math.floor(brightness * 10);
            } else {
                light.style.backgroundColor = '#300';
                light.style.boxShadow = 'none';
                light.style.zIndex = 0;
            }
        });

        animationId = requestAnimationFrame(updateScanner);
    }

    function togglePower() {
        isRunning = !isRunning;
        
        if (isRunning) {
            btnPower.classList.add('active');
            btnPower.textContent = "POWER ON";
            statusText.textContent = "SYSTEM ONLINE - SCANNING";
            statusText.classList.add('active');
            updateScanner();
            if (isSoundOn) startSound();
        } else {
            btnPower.classList.remove('active');
            btnPower.textContent = "POWER";
            statusText.textContent = "SYSTEM OFFLINE";
            statusText.classList.remove('active');
            cancelAnimationFrame(animationId);
            stopSound();
            
            // Turn off lights visually
            lights.forEach(light => {
                light.style.backgroundColor = '#300';
                light.style.boxShadow = 'none';
            });
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
});
