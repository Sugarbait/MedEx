/**
 * Logo Management Service
 * Handles uploading and storing company logos in Supabase
 * Enables cross-device synchronization of branding assets
 */

import { supabase } from '@/config/supabase'

export interface CompanyLogos {
  headerLogo?: string
  footerLogoLight?: string
  footerLogoDark?: string
  favicon?: string
  lastUpdated?: string
}

class LogoService {
  private readonly STORAGE_BUCKET = 'company-logos'
  private readonly TABLE_NAME = 'company_settings'
  private cachedLogos: CompanyLogos | null = null

  /**
   * Initialize the logo service and create storage bucket if needed
   */
  async initialize(): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === this.STORAGE_BUCKET)

      if (!bucketExists) {
        // Create public bucket for logos
        await supabase.storage.createBucket(this.STORAGE_BUCKET, {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon'],
          fileSizeLimit: 5242880 // 5MB
        })
      }
    } catch (error) {
      console.warn('Logo service initialization failed, using fallback:', error)
    }
  }

  /**
   * Upload a logo file to Supabase storage (Super Users Only)
   */
  async uploadLogo(file: File, type: 'header' | 'footer-light' | 'footer-dark' | 'favicon'): Promise<string | null> {
    try {
      // Security check: Verify user is a super user (this should be enforced on the backend as well)
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const user = JSON.parse(currentUser)
        if (user.role !== 'super_user') {
          console.error('Unauthorized: Only super users can upload company logos')
          throw new Error('Unauthorized: Only super users can upload company logos')
        }
      }
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image')
      }

      if (file.size > 5242880) {
        throw new Error('File size must be less than 5MB')
      }

      // Generate unique filename
      const timestamp = Date.now()
      const fileExt = file.name.split('.').pop()
      const fileName = `${type}_${timestamp}.${fileExt}`

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Logo upload failed:', error)
        return null
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(fileName)

      return publicUrl.publicUrl
    } catch (error) {
      console.error('Failed to upload logo:', error)
      return null
    }
  }

  /**
   * Convert file to base64 for localStorage fallback
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  /**
   * Upload logo with localStorage fallback
   */
  async uploadLogoWithFallback(file: File, type: 'header' | 'footer-light' | 'footer-dark' | 'favicon'): Promise<string | null> {
    try {
      // Try Supabase upload first
      const url = await this.uploadLogo(file, type)
      if (url) return url

      // Fallback to base64 in localStorage
      const base64 = await this.fileToBase64(file)
      return base64
    } catch (error) {
      console.error('Logo upload failed:', error)
      return null
    }
  }

  /**
   * Save company logos configuration (Super Users Only)
   */
  async saveLogos(logos: CompanyLogos): Promise<boolean> {
    try {
      // Security check: Verify user is a super user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const user = JSON.parse(currentUser)
        if (user.role !== 'super_user') {
          console.error('Unauthorized: Only super users can modify company logos')
          return false
        }
      }
      // Add timestamp
      logos.lastUpdated = new Date().toISOString()

      // Try to save to Supabase
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .upsert({
          id: 'logos',
          data: logos,
          updated_at: logos.lastUpdated
        })

      if (!error) {
        this.cachedLogos = logos
        // Also save to localStorage for offline access
        localStorage.setItem('company_logos', JSON.stringify(logos))
        return true
      }

      // Fallback to localStorage only
      localStorage.setItem('company_logos', JSON.stringify(logos))
      this.cachedLogos = logos
      return true
    } catch (error) {
      console.error('Failed to save logos:', error)

      // Last resort: save to localStorage
      try {
        localStorage.setItem('company_logos', JSON.stringify(logos))
        this.cachedLogos = logos
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Get company logos configuration
   */
  async getLogos(): Promise<CompanyLogos> {
    try {
      // Return cached if available
      if (this.cachedLogos) {
        return this.cachedLogos
      }

      // Try to fetch from Supabase
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('data')
        .eq('id', 'logos')
        .single()

      if (!error && data?.data) {
        this.cachedLogos = data.data as CompanyLogos
        // Update localStorage cache
        localStorage.setItem('company_logos', JSON.stringify(this.cachedLogos))
        return this.cachedLogos
      }

      // Fallback to localStorage
      const stored = localStorage.getItem('company_logos')
      if (stored) {
        this.cachedLogos = JSON.parse(stored)
        return this.cachedLogos
      }

      // Return default logos
      return {
        headerLogo: '/images/medex-logo.png',
        footerLogoLight: '/images/medex-logo.png',
        footerLogoDark: '/images/medex-logo.png',
        favicon: '/images/medex-favicon.png'
      }
    } catch (error) {
      console.error('Failed to get logos:', error)

      // Return default logos
      return {
        headerLogo: '/images/medex-logo.png',
        footerLogoLight: '/images/medex-logo.png',
        footerLogoDark: '/images/medex-logo.png',
        favicon: '/images/medex-favicon.png'
      }
    }
  }

  /**
   * Delete a logo (Super Users Only)
   */
  async deleteLogo(type: 'header' | 'footer-light' | 'footer-dark' | 'favicon'): Promise<boolean> {
    try {
      // Security check: Verify user is a super user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const user = JSON.parse(currentUser)
        if (user.role !== 'super_user') {
          console.error('Unauthorized: Only super users can delete company logos')
          return false
        }
      }
      const logos = await this.getLogos()

      switch (type) {
        case 'header':
          delete logos.headerLogo
          break
        case 'footer-light':
          delete logos.footerLogoLight
          break
        case 'footer-dark':
          delete logos.footerLogoDark
          break
        case 'favicon':
          delete logos.favicon
          break
      }

      return await this.saveLogos(logos)
    } catch (error) {
      console.error('Failed to delete logo:', error)
      return false
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedLogos = null
  }
}

// Export singleton instance
export const logoService = new LogoService()

// Initialize on module load
logoService.initialize().catch(console.error)