import { effectiveAccentKey } from "./branding";
import type { UserProfile, UserProfileForm } from "@/types/user";
import type { SettingsSection } from "./navigation";
export const settingsFields = {
  business: [
    "businessName",
    "businessAddress",
    "businessPhone",
    "businessAccent",
    "businessLogo",
  ],
  payments: ["bankAccounts"],
  account: ["displayName"],
} as const;
export function profileFormDefaults(user: UserProfile): UserProfileForm {
  return {
    displayName: user.displayName || "",
    businessName: user.businessName || "",
    businessAddress: user.businessAddress || "",
    businessPhone: user.businessPhone || "",
    businessAccent: effectiveAccentKey(user.businessAccent),
    businessLogo: user.businessLogo || "",
    bankAccounts: user.bankAccounts?.length
      ? user.bankAccounts
      : [{ id: "1", bankName: "", accountNumber: "", accountHolder: "" }],
  };
}
/** Sections without a profile form (they manage their own state). */
export type FormSection = Exclude<SettingsSection, "appearance" | "plan">;
export function settingsChanged(
  section: SettingsSection,
  values: UserProfileForm,
  baseline: UserProfileForm,
) {
  return (
    section !== "appearance" &&
    section !== "plan" &&
    settingsFields[section].some(
      (key) => JSON.stringify(values[key]) !== JSON.stringify(baseline[key]),
    )
  );
}
export function settingsPatch(
  section: FormSection,
  values: UserProfileForm,
): Partial<UserProfile> {
  if (section === "account") return { displayName: values.displayName.trim() };
  if (section === "payments")
    return {
      bankAccounts: values.bankAccounts.filter(
        (account) =>
          account.bankName || account.accountNumber || account.accountHolder,
      ),
    };
  return {
    businessName: values.businessName,
    businessAddress: values.businessAddress,
    businessPhone: values.businessPhone,
    businessAccent: values.businessAccent,
    businessLogo: values.businessLogo,
  };
}
