// Common social media platforms with their icons and validation patterns
export interface SocialMediaPlatform {
  name: string;
  displayName: string;
  icon: string; // Icon name
  iconUrl: string; // CDN URL for the icon
  urlPattern: string; // Regex pattern for URL validation
  placeholder: string; // Placeholder text for input
  color: string; // Brand color
}

export const SOCIAL_MEDIA_PLATFORMS: SocialMediaPlatform[] = [
  {
    name: 'linkedin',
    displayName: 'LinkedIn',
    icon: 'linkedin',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg',
    urlPattern: '^https?://(www\\.)?linkedin\\.com/in/[a-zA-Z0-9-]+/?$',
    placeholder: 'https://linkedin.com/in/yourusername',
    color: '#0077B5'
  },
  {
    name: 'twitter',
    displayName: 'Twitter',
    icon: 'twitter',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twitter.svg',
    urlPattern: '^https?://(www\\.)?twitter\\.com/[a-zA-Z0-9_]+/?$',
    placeholder: 'https://twitter.com/yourusername',
    color: '#1DA1F2'
  },
  {
    name: 'instagram',
    displayName: 'Instagram',
    icon: 'instagram',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg',
    urlPattern: '^https?://(www\\.)?instagram\\.com/[a-zA-Z0-9._]+/?$',
    placeholder: 'https://instagram.com/yourusername',
    color: '#E4405F'
  },
  {
    name: 'facebook',
    displayName: 'Facebook',
    icon: 'facebook',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/facebook.svg',
    urlPattern: '^https?://(www\\.)?facebook\\.com/[a-zA-Z0-9.]+/?$',
    placeholder: 'https://facebook.com/yourusername',
    color: '#1877F2'
  },
  {
    name: 'youtube',
    displayName: 'YouTube',
    icon: 'youtube',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/youtube.svg',
    urlPattern: '^https?://(www\\.)?youtube\\.com/(channel|user|c)/[a-zA-Z0-9_-]+/?$',
    placeholder: 'https://youtube.com/channel/yourchannel',
    color: '#FF0000'
  },
  {
    name: 'github',
    displayName: 'GitHub',
    icon: 'github',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/github.svg',
    urlPattern: '^https?://(www\\.)?github\\.com/[a-zA-Z0-9-]+/?$',
    placeholder: 'https://github.com/yourusername',
    color: '#181717'
  },
  {
    name: 'tiktok',
    displayName: 'TikTok',
    icon: 'tiktok',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/tiktok.svg',
    urlPattern: '^https?://(www\\.)?tiktok\\.com/@[a-zA-Z0-9._]+/?$',
    placeholder: 'https://tiktok.com/@yourusername',
    color: '#000000'
  },
  {
    name: 'snapchat',
    displayName: 'Snapchat',
    icon: 'snapchat',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/snapchat.svg',
    urlPattern: '^https?://(www\\.)?snapchat\\.com/add/[a-zA-Z0-9._-]+/?$',
    placeholder: 'https://snapchat.com/add/yourusername',
    color: '#FFFC00'
  },
  {
    name: 'discord',
    displayName: 'Discord',
    icon: 'discord',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/discord.svg',
    urlPattern: '^https?://discord\\.gg/[a-zA-Z0-9]+/?$',
    placeholder: 'https://discord.gg/yourinvite',
    color: '#5865F2'
  },
  {
    name: 'telegram',
    displayName: 'Telegram',
    icon: 'telegram',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/telegram.svg',
    urlPattern: '^https?://t\\.me/[a-zA-Z0-9_]+/?$',
    placeholder: 'https://t.me/yourusername',
    color: '#0088CC'
  },
  {
    name: 'whatsapp',
    displayName: 'WhatsApp',
    icon: 'whatsapp',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg',
    urlPattern: '^https?://wa\\.me/[0-9]+/?$',
    placeholder: 'https://wa.me/1234567890',
    color: '#25D366'
  },
  {
    name: 'website',
    displayName: 'Website',
    icon: 'globe',
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/globe.svg',
    urlPattern: '^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$',
    placeholder: 'https://yourwebsite.com',
    color: '#6366F1'
  }
];

export class SocialMediaService {
  // Get all available platforms
  static getPlatforms(): SocialMediaPlatform[] {
    return SOCIAL_MEDIA_PLATFORMS;
  }

  // Get platform by name
  static getPlatform(name: string): SocialMediaPlatform | undefined {
    return SOCIAL_MEDIA_PLATFORMS.find(platform => platform.name === name);
  }

  // Validate URL for a specific platform
  static validateUrl(platformName: string, url: string): boolean {
    const platform = this.getPlatform(platformName);
    if (!platform) return false;
    
    const regex = new RegExp(platform.urlPattern);
    return regex.test(url);
  }

  // Get platform name from URL (guess which platform it belongs to)
  static guessPlatformFromUrl(url: string): string | null {
    for (const platform of SOCIAL_MEDIA_PLATFORMS) {
      if (this.validateUrl(platform.name, url)) {
        return platform.name;
      }
    }
    return null;
  }

  // Format URL for a platform (add https if missing)
  static formatUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  // Get icon URL for a platform (CDN URL)
  static getIconUrl(platformName: string): string {
    const platform = this.getPlatform(platformName);
    return platform ? platform.iconUrl : 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/link.svg';
  }

  // Get brand color for a platform
  static getBrandColor(platformName: string): string {
    const platform = this.getPlatform(platformName);
    return platform ? platform.color : '#6B7280';
  }

  // Get display name for a platform
  static getDisplayName(platformName: string): string {
    const platform = this.getPlatform(platformName);
    return platform ? platform.displayName : platformName;
  }

  // Get placeholder text for a platform
  static getPlaceholder(platformName: string): string {
    const platform = this.getPlatform(platformName);
    return platform ? platform.placeholder : 'Enter URL';
  }
} 