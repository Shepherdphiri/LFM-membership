// Browser Push Notifications & gentle Audio Chimes

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function showPushNotification(title: string, body: string, iconUrl?: string) {
  playGentleChime();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: iconUrl || 'https://images.unsplash.com/photo-1548625361-195feeed9a02?w=128&auto=format&fit=crop&q=80',
        badge: '/favicon.ico',
      });
    } catch (e) {
      console.warn('Native notification failed, fall back to in-app banner', e);
    }
  }
}

// Gentle church bell / chime synthesized using Web Audio API
export function playGentleChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play warm melodic two-tone chime (F#5 -> C#6)
    const tones = [740, 1108];
    tones.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.14);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.14);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + index * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.14 + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * 0.14);
      osc.stop(ctx.currentTime + index * 0.14 + 0.9);
    });
  } catch (e) {
    // Audio context may be restricted by autoplay policy before user interaction
  }
}
