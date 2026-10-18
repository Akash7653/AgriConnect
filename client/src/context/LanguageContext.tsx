import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'te' | 'hi';

interface Translations {
  [key: string]: {
    en: string;
    te: string;
    hi: string;
  };
}

const translations: Translations = {
  // Navigation
  navMarketplace: { en: 'Marketplace', te: 'మార్కెట్‌ప్లేస్', hi: 'मंडी/बाज़ार' },
  navForFarmers: { en: 'For Farmers', te: 'రైతుల కోసం', hi: 'किसानों के लिए' },
  navB2B: { en: 'B2B Procurement', te: 'వ్యాపార ఆర్డర్లు', hi: 'थोक खरीद' },
  navLogistics: { en: 'Logistics', te: 'రవాణా సేవలు', hi: 'लॉजिस्टिक्स' },
  navAdmin: { en: 'Admin Portal', te: 'అడ్మిన్ పోర్టల్', hi: 'एडमिन पोर्टल' },
  navSignIn: { en: 'Sign In', te: 'లాగిన్', hi: 'लॉग इन' },
  navSignOut: { en: 'Sign Out', te: 'లాగ్ అవుట్', hi: 'लॉग आउट' },
  navCart: { en: 'Cart', te: 'కార్ట్', hi: 'कार्ट' },

  // Hero Section
  heroTitle: {
    en: 'From Farm to Every Table',
    te: 'రైతు పొలం నుండి ప్రతి ఇంటికి',
    hi: 'खेत से सीधे आपकी थाली तक',
  },
  heroSubtitle: {
    en: 'One Connected Network. Every Farm. Every Buyer. Fresher Food. Fairer Value.',
    te: 'ఒకే నెట్‌వర్క్. ప్రతి రైతు. ప్రతి కొనుగోలుదారు. తాజా పంట. రైతుకు న్యాయమైన ధర.',
    hi: 'एक एकीकृत नेटवर्क। हर किसान। हर खरीदार। ताज़ा भोजन। निष्पक्ष दाम।',
  },
  heroExploreMarketplace: {
    en: 'Explore Live Marketplace',
    te: 'తాజా పంటలను చూడండి',
    hi: 'ताज़ा मंडी देखें',
  },
  heroJoinFarmer: {
    en: 'Join as a Farmer / FPO',
    te: 'రైతుగా చేరండి (90% ఆదాయం)',
    hi: 'किसान के रूप में जुड़ें (90% भुगतान)',
  },

  // Trust & Value split
  farmerPayoutHeading: {
    en: 'Transparent 90% Farmer Value Share',
    te: 'రైతుకు 90% పారదర్శక చెల్లింపు',
    hi: 'किसान को पारदर्शी 90% उत्पाद मूल्य',
  },
  farmerPayoutDesc: {
    en: 'Unlike traditional supply chains where farmers retain barely 33-37% of customer spend, AgriConnect ensures 90% of product value reaches the farmer directly via verified bank / UPI payouts.',
    te: 'సాంప్రదాయ మార్కెట్లలో రైతుకు కేవలం 33-37% మాత్రమే దక్కుతుంది. కానీ AgriConnect ద్వారా మీ ఉత్పత్తుల విలువలో పూర్తి 90% నేరుగా మీ బ్యాంక్ ఖాతా లేదా UPI లో జమ అవుతుంది.',
    hi: 'पारंपरिक मंडियों में किसानों को उपभोक्ता रुपये का केवल 33-37% मिलता है। AgriConnect सुनिश्चित करता है कि उत्पाद मूल्य का पूरा 90% सीधे किसान के बैंक/UPI खाते में पहुंचे।',
  },

  // Marketplace
  allCategories: { en: 'All Categories', te: 'అన్ని విభాగాలు', hi: 'सभी श्रेणियां' },
  searchProducePlaceholder: {
    en: 'Search fresh tomatoes, rice, onions, mangoes...',
    te: 'టమాట, బియ్యం, ఉల్లిపాయలు, మామిడికాయలు వెతకండి...',
    hi: 'ताज़ा टमाटर, चावल, प्याज, आम खोजें...',
  },
  grade: { en: 'Grade', te: 'గ్రేడ్', hi: 'ग्रेड' },
  organic: { en: 'Organic', te: 'సేంద్రీయ', hi: 'जैविक' },
  addToCart: { en: 'Add to Cart', te: 'కార్ట్‌కు జోడించు', hi: 'कार्ट में डालें' },
  inStock: { en: 'In Stock', te: 'అందుబాటులో ఉంది', hi: 'स्टॉक में उपलब्ध' },
  soldOut: { en: 'Sold Out', te: 'స్టాక్ అయిపోయింది', hi: 'स्टॉक समाप्त' },
  harvested: { en: 'Harvested', te: 'కోత తేదీ', hi: 'कटाई की तारीख' },

  // AI Advisor
  aiAdvisorTitle: { en: 'AI Farm & Market Co-Pilot', te: 'AI వ్యవసాయ & మార్కెట్ సలహాదారు', hi: 'एआई कृषि व बाज़ार सलाहकार' },
  aiAdvisorPromptPlaceholder: {
    en: 'Ask in English, Telugu, or Hindi (e.g. crop prices, pest advice, demand)...',
    te: 'తెలుగు, ఇంగ్లీష్ లేదా హిందీలో అడగండి (ఉదా: మార్కెట్ ధరలు, తెగుళ్ల నివారణ)...',
    hi: 'हिंदी, तेलुगु या अंग्रेज़ी में पूछें (जैसे: मंडी भाव, फसल रोग, मांग)...',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('agriconnect_lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('agriconnect_lang', lang);
  };

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
