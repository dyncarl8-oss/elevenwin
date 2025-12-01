import Whop from "@whop/sdk";

if (!process.env.WHOP_API_KEY) {
  console.warn("WHOP_API_KEY not found. Whop authentication will not work.");
}

if (!process.env.WHOP_APP_ID) {
  console.warn("WHOP_APP_ID not found. Whop authentication will not work.");
}

export const whopClient = new Whop({
  apiKey: process.env.WHOP_API_KEY || "",
  appID: process.env.WHOP_APP_ID || "",
});

export async function verifyUserToken(token: string): Promise<{ userId: string } | null> {
  try {
    const decoded = await whopClient.verifyUserToken(token);
    return { userId: decoded.userId };
  } catch (error) {
    console.error("Failed to verify Whop user token:", error);
    return null;
  }
}

export async function checkUserAccess(
  resourceId: string,
  userId: string
): Promise<{ hasAccess: boolean; accessLevel: string }> {
  try {
    const response = await whopClient.users.checkAccess(resourceId, { id: userId });
    return {
      hasAccess: response.has_access || false,
      accessLevel: response.access_level || "no_access",
    };
  } catch (error) {
    console.error("Failed to check user access:", error);
    return { hasAccess: false, accessLevel: "no_access" };
  }
}

export interface WhopUserProfile {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
}

export async function retrieveUser(userId: string): Promise<WhopUserProfile | null> {
  try {
    const user = await whopClient.users.retrieve(userId);
    let profilePictureUrl = user.profile_picture?.url || null;
    
    if (profilePictureUrl && !profilePictureUrl.startsWith('http')) {
      profilePictureUrl = `https://whop.com${profilePictureUrl.startsWith('/') ? '' : '/'}${profilePictureUrl}`;
    }
    
    return {
      id: user.id,
      username: user.username,
      name: user.name || null,
      bio: user.bio || null,
      profilePicture: profilePictureUrl,
    };
  } catch (error) {
    console.error("Failed to retrieve user profile:", error);
    return null;
  }
}

export interface ExperienceInfo {
  id: string;
  name: string;
  companyId: string;
  companyTitle: string;
}

const experienceCache = new Map<string, ExperienceInfo>();

export async function getExperienceInfo(experienceId: string): Promise<ExperienceInfo | null> {
  if (experienceCache.has(experienceId)) {
    return experienceCache.get(experienceId)!;
  }
  
  try {
    const experience = await whopClient.experiences.retrieve(experienceId);
    const info: ExperienceInfo = {
      id: experience.id,
      name: experience.name,
      companyId: experience.company.id,
      companyTitle: experience.company.title,
    };
    experienceCache.set(experienceId, info);
    console.log(`[Whop] Cached experience ${experienceId} with company ${info.companyId}`);
    return info;
  } catch (error) {
    console.error("Failed to retrieve experience:", error);
    return null;
  }
}

export async function getCompanyIdFromExperience(experienceId: string): Promise<string | null> {
  const info = await getExperienceInfo(experienceId);
  return info?.companyId || null;
}

export interface PaymentVerification {
  valid: boolean;
  status: string | null;
  amountCents: number;
  userId: string | null;
  error?: string;
}

export async function verifyPayment(paymentId: string): Promise<PaymentVerification> {
  try {
    const payment = await whopClient.payments.retrieve(paymentId);
    
    const status = payment.status;
    const isPaid = status === "paid";
    const amountCents = Math.round((payment.total || 0) * 100);
    const userId = payment.user?.id || null;
    
    console.log(`[Whop] Payment verification for ${paymentId}: status=${status}, amount=${amountCents}cents, user=${userId}`);
    
    return {
      valid: isPaid,
      status,
      amountCents,
      userId,
    };
  } catch (error: any) {
    console.error("Failed to verify payment:", error);
    return {
      valid: false,
      status: null,
      amountCents: 0,
      userId: null,
      error: error.message || "Failed to verify payment",
    };
  }
}
