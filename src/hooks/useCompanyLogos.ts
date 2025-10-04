/**
 * Hook to manage company logos across the application
 */

import { useState, useEffect } from 'react'
import { logoService, CompanyLogos } from '@/services/logoService'

export const useCompanyLogos = () => {
  const [logos, setLogos] = useState<CompanyLogos>({
    headerLogo: '/images/medex-logo.png',
    footerLogoLight: '/images/medex-logo.png',
    footerLogoDark: '/images/medex-logo.png',
    favicon: '/images/medex-favicon.png'
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLogos = async () => {
      try {
        const companyLogos = await logoService.getLogos()
        setLogos(companyLogos)
      } catch (error) {
        console.error('Failed to load company logos:', error)
        // Keep default logos on error
      } finally {
        setIsLoading(false)
      }
    }

    loadLogos()

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'company_logos' && e.newValue) {
        try {
          const updatedLogos = JSON.parse(e.newValue)
          setLogos(updatedLogos)
        } catch (error) {
          console.error('Failed to parse logos from storage:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return { logos, isLoading }
}