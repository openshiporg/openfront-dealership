'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export async function updateOnboardingStatus(status: OnboardingStatus) {
  try {
    const query = `
      mutation UpdateOnboardingStatus($data: UserUpdateProfileInput!) {
        updateActiveUser(data: $data) {
          id
          onboardingStatus
        }
      }
    `;

    const response = await keystoneClient(query, {
      data: { onboardingStatus: status }
    });

    if (!response.success || !response.data?.updateActiveUser?.id || response.data.updateActiveUser.onboardingStatus !== status) {
      return { success: false, error: response.error || "Setup status was not saved" };
    }

    // Revalidate dashboard pages to reflect the change
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/(admin)');

    return { success: true, data: response.data?.updateActiveUser };
  } catch (error) {
    console.error('Error updating onboarding status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

export async function dismissOnboarding() {
  return updateOnboardingStatus('dismissed');
}

export async function startOnboarding() {
  return updateOnboardingStatus('in_progress');
}

export async function completeOnboarding() {
  return updateOnboardingStatus('completed');
}

/**
 * `configured` means a rooftop already exists. `resumable` means this user has a setup run
 * in progress (a partial failure leaves the status at `in_progress`), so a retry may reuse
 * the records it already saved instead of being refused as a second dealership.
 */
export async function getStoreSetupState() {
  const response = await keystoneClient(`query StoreSetupState { rooftopsCount authenticatedItem { ... on User { id onboardingStatus } } }`);
  if (!response.success) {
    return { success: false as const, configured: false, resumable: false };
  }
  const onboardingStatus = response.data?.authenticatedItem?.onboardingStatus ?? null;
  return {
    success: true as const,
    configured: (response.data?.rooftopsCount ?? 0) > 0,
    resumable: onboardingStatus === 'in_progress',
  };
}
