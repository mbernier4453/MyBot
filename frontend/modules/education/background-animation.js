/**
 * Interactive Background Animation
 * Mouse-following particle network
 */

class InteractiveBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.warn('[Background] Canvas not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.particleCount = 80;
    this.mouse = { x: null, y: null, radius: 150 };
    this.connectionDistance = 120;
    this.animationId = null;

    this.init();
  }

  init() {
    this.resize();
    this.createParticles();
    this.addEventListeners();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = Math.max(document.body.scrollHeight, window.innerHeight);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        baseSpeed: Math.random() * 0.3 + 0.1
      });
    }
  }

  addEventListeners() {
    window.addEventListener('resize', () => {
      this.resize();
      this.createParticles();
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY + window.scrollY;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });

    // Handle scroll
    window.addEventListener('scroll', () => {
      if (this.mouse.x !== null) {
        this.mouse.y = event.clientY + window.scrollY;
      }
    });
  }

  animate() {
    // Semi-transparent fill for trail effect
    this.ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, index) => {
      // Mouse interaction
      if (this.mouse.x !== null && this.mouse.y !== null) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.mouse.radius) {
          const force = (this.mouse.radius - dist) / this.mouse.radius;
          p.vx += (dx / dist) * force * 0.05;
          p.vy += (dy / dist) * force * 0.05;
        }
      }

      // Apply velocity
      p.x += p.vx;
      p.y += p.vy;

      // Damping
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Boundary bounce
      if (p.x < 0 || p.x > this.canvas.width) {
        p.vx *= -1;
        p.x = Math.max(0, Math.min(this.canvas.width, p.x));
      }
      if (p.y < 0 || p.y > this.canvas.height) {
        p.vy *= -1;
        p.y = Math.max(0, Math.min(this.canvas.height, p.y));
      }

      // Draw particle
      this.ctx.fillStyle = 'rgba(0, 170, 85, 0.7)';
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw connections to nearby particles
      this.particles.slice(index + 1).forEach(p2 => {
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.connectionDistance) {
          const opacity = 0.3 * (1 - dist / this.connectionDistance);
          this.ctx.strokeStyle = `rgba(0, 170, 85, ${opacity})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      });
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Initialize on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new InteractiveBackground('bg-canvas');
  });
} else {
  new InteractiveBackground('bg-canvas');
}
