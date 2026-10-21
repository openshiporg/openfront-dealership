import { useRef } from 'react'
import { GraphQLClient } from 'graphql-request'
import { startOnboarding, completeOnboarding } from '../actions/onboarding'
import { seedItemLabel, type SectionType } from '../config/templates'
import { requestSeedRecord, runSeedPhases, validateDealershipSeed, type SeedEntity } from '../utils/seedRecords'
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo'
import type { OnboardingStep, TemplateType } from './useOnboardingState'

const GRAPHQL_ENDPOINT = '/api/graphql'

interface OnboardingApiProps {
  selectedTemplate: TemplateType
  currentJsonData: any
  completedItems: Record<string, string[]>
  setProgress: (message: string) => void
  setItemLoading: (type: string, item: string) => void
  setItemCompleted: (type: string, item: string) => void
  setItemError: (type: string, item: string, errorMessage: string) => void
  setStep: (step: OnboardingStep) => void
  setError: (error: string | null) => void
  setIsLoading: (loading: boolean) => void
  resetOnboardingState: () => void
}

function errorMessage(error: any) {
  if (error?.response?.errors?.length) {
    return error.response.errors.map((item: any) => item.message || 'Unknown error').join('\n')
  }
  return error?.message || 'Unknown error'
}

export function useOnboardingApi({
  currentJsonData,
  setProgress,
  setItemLoading,
  setItemCompleted,
  setItemError,
  setStep,
  setError,
  setIsLoading,
  resetOnboardingState,
}: OnboardingApiProps) {
  const running = useRef(false)

  const runOnboarding = async () => {
    if (running.current) return
    running.current = true
    setIsLoading(true)
    setError(null)
    resetOnboardingState()
    setStep('progress')
    setProgress('Starting onboarding...')

    try {
      validateDealershipSeed(currentJsonData)
      const client = new GraphQLClient(GRAPHQL_ENDPOINT, { headers: { 'Content-Type': 'application/json' } })
      const data = currentJsonData
      let rooftopId = ''

      // Each record is saved on its own; a retry reuses records that were already saved.
      const createSection = async (
        type: SectionType,
        entity: SeedEntity,
        message: string,
        records: any[],
        toInput: (record: any) => any
      ) => {
        setProgress(message)
        for (const record of records) {
          const label = seedItemLabel(type, record)
          setItemLoading(type, label)
          try {
            const saved = await requestSeedRecord(client, entity, toInput(record))
            setItemCompleted(type, label)
            if (saved.rooftopId) rooftopId = saved.rooftopId
          } catch (itemError) {
            setItemError(type, label, errorMessage(itemError))
            throw itemError
          }
        }
      }
      const atRooftop = (record: any) => ({ ...record, rooftopId })

      await runSeedPhases(startOnboarding, [
        () => createSection('dealership', 'Dealership', 'Creating dealership...', [data.dealership], dealership => ({
          ...dealership,
          logoIcon: dealership.logoIcon || DEFAULT_STORE_LOGO_ICON,
          logoColor: normalizeStoreLogoColor(dealership.logoColor || DEFAULT_STORE_LOGO_COLOR),
        })),
        () => createSection('vehicleMakes', 'Make', 'Creating vehicle makes...', data.vehicleMakes, make => ({ name: make.name })),
        () => createSection('vehicleModels', 'Model', 'Creating vehicle models...', data.vehicleModels, model => model),
        () => createSection('vehicles', 'Vehicle', 'Adding vehicle inventory...', data.vehicles, atRooftop),
        () => createSection('services', 'ServicePackage', 'Creating service packages...', data.services, atRooftop),
        () => createSection('parts', 'Part', 'Stocking parts...', data.parts, atRooftop),
        () => createSection('financeProducts', 'FinanceProduct', 'Creating finance products...', data.financeProducts, atRooftop),
        () => createSection('leadRoutingRules', 'LeadRoutingRule', 'Creating lead routing rules...', data.leadRoutingRules, atRooftop),
        () => createSection('accountingMappings', 'AccountingMapping', 'Creating accounting mappings...', data.accountingMappings, atRooftop),
        () => createSection('paymentProviders', 'PaymentProvider', 'Installing payment providers...', data.paymentProviders, provider => provider),
        () => createSection('staff', 'Role', 'Creating staff roles...', data.staff, role => role),
      ], completeOnboarding)

      setProgress('Onboarding complete!')
      setStep('done')
    } catch (error) {
      const message = errorMessage(error)
      setError(message)
      console.error('Error during onboarding:', message)
    } finally {
      running.current = false
      setIsLoading(false)
    }
  }

  return { runOnboarding }
}
