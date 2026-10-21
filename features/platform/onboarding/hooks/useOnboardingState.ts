import { useEffect, useState } from 'react'
import seedData from '../lib/seed.json'
import { SECTION_TYPES } from '../config/templates'
import { emptySectionItems, getItemsFromJsonData, getSeedForTemplate } from '../utils/dataUtils'

export type OnboardingStep = 'template' | 'progress' | 'done'
export type TemplateType = 'full' | 'minimal' | 'custom'

type ItemState = Record<string, string[]>

export interface OnboardingState {
  step: OnboardingStep
  selectedTemplate: TemplateType
  currentJsonData: any
  customJsonApplied: boolean
  progressMessage: string
  loadingItems: ItemState
  completedItems: ItemState
  error: string | null
  itemErrors: Record<string, Record<string, string>>
  isLoading: boolean
}

const emptyItems = (): ItemState => emptySectionItems()

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>({
    step: 'template',
    selectedTemplate: 'full',
    currentJsonData: null,
    customJsonApplied: false,
    progressMessage: '',
    loadingItems: emptyItems(),
    completedItems: emptyItems(),
    error: null,
    itemErrors: {},
    isLoading: false,
  })

  useEffect(() => {
    const template = state.selectedTemplate === 'custom' ? 'minimal' : state.selectedTemplate
    setState(previous => ({
      ...previous,
      currentJsonData: getSeedForTemplate(template, seedData),
      customJsonApplied: false,
    }))
  }, [state.selectedTemplate])

  const update = (patch: Partial<OnboardingState>) => setState(previous => ({ ...previous, ...patch }))
  const setStep = (step: OnboardingStep) => update({ step })
  const setSelectedTemplate = (selectedTemplate: TemplateType) => update({ selectedTemplate })
  const setCurrentJsonData = (currentJsonData: any) => update({ currentJsonData })
  const setCustomJsonApplied = (customJsonApplied: boolean) => update({ customJsonApplied })
  const setIsLoading = (isLoading: boolean) => update({ isLoading })
  const setError = (error: string | null) => update({ error })
  const setProgress = (progressMessage: string) => update({ progressMessage })
  const setLoadingItems = (loadingItems: ItemState) => update({ loadingItems })
  const setCompletedItems = (completedItems: ItemState) => update({ completedItems })
  const setItemErrors = (itemErrors: Record<string, Record<string, string>>) => update({ itemErrors })

  const getDisplayNamesFromData = (data: any) =>
    Object.fromEntries(SECTION_TYPES.map(type => [type, getItemsFromJsonData(data, type)]))

  const setItemLoading = (type: string, item: string) => {
    setState(previous => {
      const nextErrors = { ...(previous.itemErrors[type] || {}) }
      delete nextErrors[item]
      return {
        ...previous,
        loadingItems: {
          ...previous.loadingItems,
          [type]: [...new Set([...(previous.loadingItems[type] || []), item])],
        },
        itemErrors: { ...previous.itemErrors, [type]: nextErrors },
      }
    })
  }

  const setItemCompleted = (type: string, item: string) => {
    setState(previous => {
      const nextErrors = { ...(previous.itemErrors[type] || {}) }
      delete nextErrors[item]
      return {
        ...previous,
        loadingItems: {
          ...previous.loadingItems,
          [type]: (previous.loadingItems[type] || []).filter(value => value !== item),
        },
        completedItems: {
          ...previous.completedItems,
          [type]: [...new Set([...(previous.completedItems[type] || []), item])],
        },
        itemErrors: { ...previous.itemErrors, [type]: nextErrors },
      }
    })
  }

  const setItemError = (type: string, item: string, errorMessage: string) => {
    setState(previous => ({
      ...previous,
      loadingItems: {
        ...previous.loadingItems,
        [type]: (previous.loadingItems[type] || []).filter(value => value !== item),
      },
      itemErrors: {
        ...previous.itemErrors,
        [type]: { ...(previous.itemErrors[type] || {}), [item]: errorMessage },
      },
    }))
  }

  const resetOnboardingState = () => update({
    error: null,
    itemErrors: {},
    loadingItems: emptyItems(),
    completedItems: emptyItems(),
  })

  return {
    ...state,
    setStep,
    setSelectedTemplate,
    setCurrentJsonData,
    setCustomJsonApplied,
    setIsLoading,
    setError,
    setProgress,
    setLoadingItems,
    setCompletedItems,
    setItemErrors,
    setItemLoading,
    setItemCompleted,
    setItemError,
    resetOnboardingState,
    getDisplayNamesFromData,
  }
}
