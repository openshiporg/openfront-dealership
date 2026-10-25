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
 * `configured` means the dealership has been set up: its profile is saved or someone holds a
 * dealer group membership. A rooftop alone does not count, because the rooftop-scope migration
 * inserts a member-less default group and rooftop on every install, including a fresh one, and
 * onboarding adopts that rooftop by slug rather than creating a second dealership.
 * `resumable` means this user has a setup run in progress (a partial failure leaves the status
 * at `in_progress`), so a retry may reuse the records it already saved.
 */
export async function getStoreSetupState() {
  const response = await keystoneClient(`query StoreSetupState { dealershipProfile { id } dealerGroupMembershipsCount authenticatedItem { ... on User { id onboardingStatus } } }`);
  if (!response.success) {
    return { success: false as const, configured: false, resumable: false };
  }
  const onboardingStatus = response.data?.authenticatedItem?.onboardingStatus ?? null;
  return {
    success: true as const,
    configured: Boolean(response.data?.dealershipProfile?.id) || (response.data?.dealerGroupMembershipsCount ?? 0) > 0,
    resumable: onboardingStatus === 'in_progress',
  };
}
