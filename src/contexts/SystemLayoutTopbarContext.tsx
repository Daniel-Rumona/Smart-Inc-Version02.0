import {
    createContext,
    useContext,
    useLayoutEffect,
    type Dispatch,
    type SetStateAction,
} from 'react'

export type SystemLayoutPageChrome = {
    showBackButton: boolean
    hideSidebar: boolean
    /** Hides the system topbar pill and bottom bar on phones so the page can render its own. Desktop is unaffected. */
    hideChrome: boolean
}

type SystemLayoutChromeSetter = Dispatch<SetStateAction<SystemLayoutPageChrome>>

const DEFAULT_CHROME: SystemLayoutPageChrome = {
    showBackButton: false,
    hideSidebar: false,
    hideChrome: false,
}

export const SystemLayoutTopbarContext =
    createContext<SystemLayoutChromeSetter | null>(null)

/**
 * Use on focused pages that should replace the sidebar toggle with a Back button.
 * By default the sidebar is also completely hidden for that page.
 */
export const useTopbarBackButton = (
    options: { hideSidebar?: boolean } = {},
) => {
    const setChrome = useContext(SystemLayoutTopbarContext)
    const hideSidebar = options.hideSidebar ?? true

    useLayoutEffect(() => {
        if (!setChrome) return

        setChrome({
            showBackButton: true,
            hideSidebar,
            hideChrome: false,
        })

        return () => {
            setChrome(DEFAULT_CHROME)
        }
    }, [hideSidebar, setChrome])
}

/**
 * Use on a phone-first flow (e.g. a one-question-at-a-time form) that wants
 * full control of its own header and a bottom-docked action bar. On phones
 * this removes the system topbar pill and bottom bar entirely; the desktop
 * shell is untouched.
 */
export const useFullscreenMobilePage = () => {
    const setChrome = useContext(SystemLayoutTopbarContext)

    useLayoutEffect(() => {
        if (!setChrome) return

        setChrome({
            showBackButton: false,
            hideSidebar: true,
            hideChrome: true,
        })

        return () => {
            setChrome(DEFAULT_CHROME)
        }
    }, [setChrome])
}
