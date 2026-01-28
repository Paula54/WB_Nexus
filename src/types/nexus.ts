import React from 'react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export enum PageType {
  DASHBOARD = 'dashboard',
  BUILDER = 'builder',
  SOCIAL = 'social',
  SEO = 'seo',
  WHATSAPP = 'whatsapp',
  STRATEGY = 'strategy'
}

export interface WebsiteSection {
  id: string;
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'contact' | 'custom_html';
  content: {
    title: string;
    subtitle?: string;
    buttonText?: string;
    items?: Array<{ title: string; desc: string }>;
    backgroundImage?: string;
    icon?: string;
    html?: string;
  };
}

export interface SocialPost {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin';
  content: string;
  date: string;
  status: 'draft' | 'scheduled' | 'published';
  hashtags: string[];
}

export interface SeoAnalysis {
  score: number;
  suggestions: string[];
  keywords: string[];
}

export interface WhatsAppFlow {
  id: string;
  trigger: string;
  response: string;
  isActive: boolean;
}

export interface MarketingStrategyInput {
  clientName: string;
  productService: string;
  audience: string;
  objective: string;
  plan: 'START' | 'PRO' | 'ELITE';
}

export interface MarketingStrategyResult {
  site: {
    html: string;
    seo_title: string;
    meta_description: string;
  };
  ads: {
    google: {
      headlines: string[];
      descriptions: string[];
      keywords: string[];
    };
    meta: {
      primary_text: string;
      headline: string;
    };
  };
  social_media: Array<{
    day: string;
    theme: string;
    caption: string;
    image_prompt: string;
  }>;
  whatsapp_flow: Array<{
    trigger: string;
    response: string;
  }>;
  integration_payload: {
    hostinger_config: {
      domain: string;
      template_id: string;
    };
    google_ads_config: {
      campaign_name: string;
      budget_daily: number;
    };
  };
}
