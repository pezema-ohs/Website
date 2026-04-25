"use client";
import React from "react";
import Banner from "../common/banner/Banner";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useGetPoliciesQuery } from "@/store/Apis/policiesApi/policiesApi";
function PrivacyPolicy() {
  const { data: policies, isLoading } = useGetPoliciesQuery();
  const tPrivacy = useTranslations("policies.privacy");
  const privacyContent = policies?.data?.privacyPolicy || "";

  // console.log("policies ==========>>>>>>", policies);

  return (
    <div className="min-h-screen bg-white">
      <Banner
        title={tPrivacy("title")}
        description={tPrivacy("description")}
        image="/policies/privacy_policy.png"
      />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : privacyContent ? (
          <div
            className="prose prose-lg max-w-none text-gray-600 leading-relaxed min-h-screen"
            dangerouslySetInnerHTML={{ __html: privacyContent }}
          />
        ) : (
          <div className="text-center py-12 min-h-screen">
            <p className="text-gray-600">No content available.</p>
          </div>
        )}
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
          <Image
            src="/watermark.webp"
            alt="Privacy Policy"
            width={1000}
            height={1000}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain opacity-40 w-full xl:w-[85%] 2xl:w-[95%] h-full"
          />
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
