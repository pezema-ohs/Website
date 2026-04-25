"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import Backbutton from "@/components/common/backbutton/backbutton";
import { Checkbox } from "@/components/ui/checkbox";
import { useDateOfBirthValidation } from "@/hooks/useDateOfBirthValidation";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

// Format date as mm/dd/yyyy
const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return "";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  } catch {
    return "";
  }
};

interface ContactDetailsProps {
  formData: {
    email: string;
    contactNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  onInputChange: (field: string, value: string) => void;
  onNext: () => void;
}

export default function ContactDetails({
  formData,
  onInputChange,
  onNext,
}: ContactDetailsProps) {
  const t = useTranslations("contactDetails");
  const [errors, setErrors] = useState<{
    email?: string;
    contactNumber?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    termsAgreed?: string;
  }>({});
  const [termsAgreed, setTermsAgreed] = useState<boolean>(false);
  const { getDateOfBirthError } = useDateOfBirthValidation();

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = "Contact number is required";
    } else if (!isValidPhoneNumber(formData.contactNumber)) {
      newErrors.contactNumber = "Please enter a valid phone number";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    const dateError = getDateOfBirthError(formData.dateOfBirth);
    if (dateError) newErrors.dateOfBirth = dateError;

    if (!termsAgreed) {
      newErrors.termsAgreed = "You must agree to the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextClick = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    onInputChange(field, value);
    // Clear error for this field when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="p-6 relative min-h-[600px]">
      <div className="flex items-center gap-2 mb-6 relative z-20">
        <Backbutton />
        <h2 className="text-2xl font-bold text-gray-900 ">{t("title")}</h2>
      </div>

      <div className="space-y-4 relative z-20">
        {/* Email Address */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            {t("emailAddress.label")}
          </label>
          <Input
            type="email"
            placeholder={t("emailAddress.placeholder")}
            value={formData.email}
            onChange={(e) => handleFieldChange("email", e.target.value)}
            className={`w-full ${errors.email ? "border-red-500" : ""}`}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Contact Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            {t("contactNumber.label")}
          </label>
          <PhoneInput
            defaultCountry="US"
            international
            placeholder={t("contactNumber.placeholder")}
            value={formData.contactNumber || undefined}
            onChange={(val) => handleFieldChange("contactNumber", val ?? "")}
            className={cn(
              "PhoneInput flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent pl-2 pr-0 shadow-xs transition-[color,box-shadow] outline-none",
              "[&_.PhoneInputCountry]:bg-transparent [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:focus-visible:ring-0 [&_.PhoneInputInput]:outline-none",
              "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
              "text-sm",
              errors.contactNumber && "!border-red-500",
            )}
            // numberInputProps={{
            //   className: cn(
            //     "flex h-10 w-full min-w-0 flex-1 rounded-r-md border-0 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground",
            //     "focus-visible:ring-0 focus-visible:ring-offset-0"
            //   ),
            // }}
            inputComponent={Input}
          />
          {errors.contactNumber && (
            <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>
          )}
        </div>

        {/* Legal Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            {t("legalName.label")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                type="text"
                placeholder={t("legalName.firstNamePlaceholder")}
                value={formData.firstName}
                onChange={(e) => handleFieldChange("firstName", e.target.value)}
                className={errors.firstName ? "border-red-500" : ""}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <Input
                type="text"
                placeholder={t("legalName.lastNamePlaceholder")}
                value={formData.lastName}
                onChange={(e) => handleFieldChange("lastName", e.target.value)}
                className={errors.lastName ? "border-red-500" : ""}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>
        </div>
        {/* Instructional Text */}
        <p className="text-[11px] italic  text-gray-600 text-justify">
          * {t("instructionalText.text")}
        </p>
        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            {t("dateOfBirth.label")}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-between text-left font-normal ${
                  errors.dateOfBirth ? "border-red-500" : ""
                }`}
              >
                {formData.dateOfBirth &&
                formatDateDisplay(formData.dateOfBirth) ? (
                  formatDateDisplay(formData.dateOfBirth)
                ) : (
                  <span className="text-muted-foreground">
                    {t("dateOfBirth.placeholder")}
                  </span>
                )}
                <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={
                  formData.dateOfBirth
                    ? new Date(formData.dateOfBirth)
                    : undefined
                }
                defaultMonth={new Date()} // Start at current month
                onSelect={(date) => {
                  // Prevent future dates - compare dates without time
                  if (date) {
                    const today = new Date();
                    today.setHours(23, 59, 59, 999); // End of today
                    const selectedDate = new Date(date);
                    selectedDate.setHours(0, 0, 0, 0);

                    // Only allow dates that are today or in the past
                    if (selectedDate <= today) {
                      const iso = date.toISOString();
                      handleFieldChange("dateOfBirth", iso);
                      // Validate age as soon as date is selected (under 13 = show error)
                      const dateError = getDateOfBirthError(iso);
                      setErrors((prev) => ({
                        ...prev,
                        dateOfBirth: dateError,
                      }));
                    }
                  }
                }}
                captionLayout="dropdown"
                fromYear={1900}
                toYear={new Date().getFullYear()}
                toDate={new Date()} // Set maximum date to today - prevents navigation to future dates
                disabled={(date) => {
                  // Disable future dates (dates after today)
                  const today = new Date();
                  today.setHours(23, 59, 59, 999); // End of today
                  const checkDate = new Date(date);
                  checkDate.setHours(0, 0, 0, 0);
                  return checkDate > today;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.dateOfBirth && (
            <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>
          )}
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms-agreement"
            checked={termsAgreed}
            onCheckedChange={(checked) => {
              setTermsAgreed(checked === true);
              if (errors.termsAgreed) {
                setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
              }
            }}
            className={`mt-1 ${errors.termsAgreed ? "border-red-500" : ""}`}
          />
          <label
            htmlFor="terms-agreement"
            className="text-sm text-gray-600 leading-relaxed cursor-pointer"
          >
            {t("termsAndConditions.text")}{" "}
            <Link
              href="/policies/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-peter hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {t("termsAndConditions.termsOfService")}
            </Link>
            , {t("termsAndConditions.acknowledge")}{" "}
            <Link
              href="/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-peter hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {t("termsAndConditions.privacyPolicy")}
            </Link>
            .
          </label>
        </div>
        {errors.termsAgreed && (
          <p className="text-red-500 text-xs mt-1">{errors.termsAgreed}</p>
        )}

        {/* Agree and Continue Button */}
        <Button
          onClick={handleNextClick}
          disabled={!termsAgreed}
          className={`w-full py-3 rounded-lg font-semibold ${
            termsAgreed
              ? "bg-peter hover:bg-peter-dark text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {t("agreeAndContinue")}
        </Button>
      </div>

      {/* Watermark */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
        <Image
          src="/watermark.webp"
          alt="watermark"
          width={1000}
          height={1000}
          className="object-contain w-60 h-60 -rotate-45 opacity-100"
        />
      </div>
    </div>
  );
}
