import React from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { tr } from '../i18n.ts';

export function PolicyView({ policyKey }: { policyKey: string }) {
  const { settings, navigate, language } = useStore();

  const POLICY_MAP: Record<string, { title: string; body: string }> = {
    about_story: {
      title: tr(language, 'About SHOPNEXA ROBI HUB', 'SHOPNEXA ROBI HUB সম্পর্কে'),
      body:
        language === 'bn'
          ? 'SHOPNEXA ROBI HUB — কেনাকাটার ভবিষ্যৎ। এটি একটি আন্তর্জাতিক হাইব্রিড মার্কেটপ্লেস যেখানে সরাসরি নিজস্ব পণ্য এবং যাচাইকৃত পার্টনার কালেকশন পাওয়া যায়।'
          : settings?.about_story ||
            'SHOPNEXA ROBI HUB — THE FUTURE OF SHOPPING is an international hybrid marketplace offering both direct-selling products and curated AliExpress partner discoveries.',
    },
    shipping_policy: {
      title: tr(language, 'Shipping Information', 'শিপিং ও ডেলিভারি তথ্য'),
      body:
        language === 'bn'
          ? (settings?.shipping_policy && settings.shipping_policy.trim()
              ? settings.shipping_policy
              : 'ঢাকা, রংপুর এবং সারা বাংলাদেশে ক্যাশ অন ডেলিভারি ও কুরিয়ার সেবা চালু আছে। আন্তর্জাতিক অর্ডারে এক্সপ্রেস শিপিং সুবিধা রয়েছে। অর্ডার ট্র্যাকিং পেজ থেকে রিয়েল-টাইম অবস্থা দেখা যাবে।')
          : settings?.shipping_policy || '',
    },
    return_policy: {
      title: tr(language, 'Return Policy', 'রিটার্ন নীতিমালা'),
      body:
        language === 'bn'
          ? (settings?.return_policy && settings.return_policy.trim()
              ? settings.return_policy
              : 'পণ্য ডেলিভারির ৭ দিনের মধ্যে ত্রুটিপূর্ণ বা ভুল পণ্য হলে রিটার্ন বা এক্সচেঞ্জের জন্য আবেদন করা যাবে।')
          : settings?.return_policy || '',
    },
    refund_policy: {
      title: tr(language, 'Refund Policy', 'রিফান্ড নীতিমালা'),
      body:
        language === 'bn'
          ? (settings?.refund_policy && settings.refund_policy.trim()
              ? settings.refund_policy
              : 'রিটার্ন যাচাই সম্পন্ন হওয়ার ৩-৭ কর্মদিবসের মধ্যে বিকাশ, নগদ বা মূল পেমেন্ট মাধ্যমে রিফান্ড প্রদান করা হয়।')
          : settings?.refund_policy || '',
    },
    privacy_policy: {
      title: tr(language, 'Privacy Policy', 'প্রাইভেসি পলিসি'),
      body:
        language === 'bn'
          ? (settings?.privacy_policy && settings.privacy_policy.trim()
              ? settings.privacy_policy
              : 'আপনার ডেলিভারি ঠিকানা, ফোন নম্বর ও অর্ডার তথ্য সম্পূর্ণ গোপন রাখা হয় এবং শুধুমাত্র ডেলিভারি ও সাপোর্টের কাজে ব্যবহৃত হয়।')
          : settings?.privacy_policy || '',
    },
    terms_conditions: {
      title: tr(language, 'Terms & Conditions', 'শর্তাবলী'),
      body:
        language === 'bn'
          ? (settings?.terms_conditions && settings.terms_conditions.trim()
              ? settings.terms_conditions
              : 'অর্ডার করার আগে পণ্যের মূল্য, রঙ, সাইজ এবং ডেলিভারি তথ্য যাচাই করে নিন। আমরা কখনোই বিকাশ/নগদ পিন বা OTP চাই না।')
          : settings?.terms_conditions || '',
    },
    affiliate_disclosure: {
      title: tr(language, 'Affiliate Disclosure', 'অ্যাফিলিয়েট ডিসক্লোজার'),
      body:
        language === 'bn'
          ? (settings?.affiliate_disclosure && settings.affiliate_disclosure.trim()
              ? settings.affiliate_disclosure
              : 'অ্যাফিলিয়েট পার্টনার পণ্যগুলো অফিশিয়াল পার্টনার লিংকের মাধ্যমে AliExpress-এ সম্পন্ন হয়।')
          : settings?.affiliate_disclosure || '',
    },
    faq: {
      title: tr(language, 'Frequently Asked Questions', 'সাধারণ প্রশ্নোত্তর (FAQ)'),
      body:
        language === 'bn'
          ? 'প্রশ্ন: নিজস্ব পণ্য ও অ্যাফিলিয়েট পণ্যের মধ্যে পার্থক্য কী?\n' +
            'উত্তর: নিজস্ব পণ্য সরাসরি SHOPNEXA ROBI HUB থেকে বিকাশ, নগদ, ক্যাশ অন ডেলিভারি বা কার্ডে কেনা যায়। অ্যাফিলিয়েট পণ্য অফিসিয়াল পার্টনার লিংকের মাধ্যমে AliExpress-এ সম্পন্ন হয়।\n\n' +
            'প্রশ্ন: SHOPNEXA ROBI HUB কি কখনো আমার বিকাশ বা নগদ পিন বা OTP চায়?\n' +
            'উত্তর: কখনোই না। আমরা শুধুমাত্র পেমেন্ট ট্রানজেকশন আইডি (TrxID) যাচাই করি।\n\n' +
            'প্রশ্ন: অর্ডার করার পর ডেলিভারি ট্র্যাক করবো কীভাবে?\n' +
            'উত্তর: অর্ডার সম্পন্ন হলে আপনি একটি SNX-... অর্ডার আইডি পাবেন। "অর্ডার ট্র্যাক" পেজে গিয়ে অর্ডার আইডি দিলে ডেলিভারির বর্তমান অবস্থা ও কুরিয়ার লিংক দেখা যাবে।\n\n' +
            'প্রশ্ন: কাস্টমার সাপোর্টে যোগাযোগ করবো কীভাবে?\n' +
            `উত্তর: টেলিগ্রামে ${settings?.telegram_support_username || '@ShoponexaMarketplaseSuport'} অথবা ইমেইলে ${settings?.contact_email || 'support@shopnexa.global'} ঠিকানায় যোগাযোগ করুন।`
          : 'Q: What is the difference between Own Products and Affiliate Products?\n' +
            'A: Own Products are fulfilled directly by SHOPNEXA ROBI HUB with bKash, Nagad, Cash on Delivery, or International checkout. Affiliate Products redirect to AliExpress via our official partner link where AliExpress handles payment and fulfillment.\n\n' +
            'Q: Does SHOPNEXA ROBI HUB ever ask for my bKash or Nagad PIN or OTP?\n' +
            'A: Never. SHOPNEXA ROBI HUB only verifies your Transaction ID (TrxID) or uses authorized gateway APIs.\n\n' +
            'Q: How can I contact customer support?\n' +
            `A: Reach us anytime via Telegram at ${settings?.telegram_support_username || '@ShoponexaMarketplaseSuport'} or email ${settings?.contact_email || 'support@shopnexa.global'}.`,
    },
  };

  const entry = POLICY_MAP[policyKey] || POLICY_MAP.about_story;

  return (
    <div className="max-w-3xl mx-auto px-4 py-14 space-y-6 text-zinc-100">
      <button
        type="button"
        onClick={() => navigate({ page: 'home' })}
        className="text-xs font-semibold text-zinc-300 hover:text-[#E4C76B] transition-colors"
      >
        ← {tr(language, 'Back to Homepage', 'হোমপেজে ফিরে যান')}
      </button>
      <div className="border border-zinc-800 p-8 bg-zinc-900 space-y-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#E4C76B]">
          {tr(language, 'SHOPNEXA ROBI HUB POLICY', 'SHOPNEXA ROBI HUB নীতিমালা')}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white">{entry.title}</h1>
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">{entry.body}</p>
      </div>
    </div>
  );
}
