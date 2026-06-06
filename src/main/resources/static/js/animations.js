/**
 * LC Network - GSAP Premium Animations Controller
 * Adds fluid entrance transitions, statistics count-ups, SPA page switches, 
 * dynamic content fades, and organic modal reveals.
 * Does not modify CSS layouts.
 */

(function () {
    // 1. Safe Check for GSAP
    if (typeof gsap === 'undefined') {
        console.warn('GSAP is not loaded. Animations disabled.');
        return;
    }

    // Initialize animations once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        initEntranceAnimations();
        initTabChangeObserver();
        initCountUpObserver();
        initDynamicContentObserver();
        initModalObserver();
    });

    /**
     * Entrance animations for layout wrappers depending on page type
     */
    function initEntranceAnimations() {
        // --- 1. User Page Entrance ---
        if (document.querySelector('.top-header') && document.querySelector('.main-layout')) {
            // Header Slide Down
            gsap.from('.top-header', {
                y: -60,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out',
                clearProps: 'transform,opacity'
            });

            // Sidebars Slide In
            if (document.querySelector('.left-sidebar')) {
                gsap.from('.left-sidebar', {
                    x: -50,
                    opacity: 0,
                    duration: 0.8,
                    delay: 0.1,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity'
                });
            }
            if (document.querySelector('.right-sidebar')) {
                gsap.from('.right-sidebar', {
                    x: 50,
                    opacity: 0,
                    duration: 0.8,
                    delay: 0.1,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity'
                });
            }

            // Center Feed Elements Stagger
            const feedChildren = document.querySelectorAll('.feed-section > *');
            if (feedChildren.length > 0) {
                gsap.from(feedChildren, {
                    y: 30,
                    opacity: 0,
                    duration: 0.8,
                    delay: 0.2,
                    stagger: 0.1,
                    ease: 'power2.out',
                    clearProps: 'transform,opacity'
                });
            }
        }

        // --- 2. Admin & Moderator Layout Entrance ---
        if (document.querySelector('.mod-layout')) {
            // Sidebar Slide In
            if (document.querySelector('.mod-sidebar')) {
                gsap.from('.mod-sidebar', {
                    x: -80,
                    opacity: 0,
                    duration: 0.8,
                    ease: 'power3.out'
                });
            }

            // Main Content Area Stagger
            const mainContent = document.querySelector('.mod-main-content');
            if (mainContent) {
                gsap.from(mainContent, {
                    opacity: 0,
                    y: 20,
                    duration: 0.8,
                    delay: 0.1,
                    ease: 'power2.out'
                });
            }
        }
    }

    /**
     * SPA Tab Change / Page Toggling Animations
     * Animates sections that change visibility when hidden class is toggled
     */
    function initTabChangeObserver() {
        const pages = document.querySelectorAll('.page, .mod-section');
        if (pages.length === 0) return;

        pages.forEach(page => {
            let lastState = isPageHidden(page);

            const observer = new MutationObserver(() => {
                const isHidden = isPageHidden(page);
                if (lastState && !isHidden) {
                    // Page transitioned from hidden to visible.
                    // Animate the main structural child components.
                    const children = Array.from(page.children).filter(child => {
                        return !child.classList.contains('hidden') && window.getComputedStyle(child).display !== 'none';
                    });

                    if (children.length > 0) {
                        gsap.killTweensOf(children);
                        gsap.fromTo(children, 
                            { y: 25, opacity: 0 },
                            {
                                y: 0,
                                opacity: 1,
                                duration: 0.5,
                                stagger: 0.06,
                                ease: 'power2.out',
                                clearProps: 'transform,opacity'
                            }
                        );
                    }
                }
                lastState = isHidden;
            });

            observer.observe(page, { attributes: true, attributeFilter: ['class', 'style'] });
        });
    }

    function isPageHidden(el) {
        return el.classList.contains('hidden') || window.getComputedStyle(el).display === 'none';
    }

    /**
     * Statistics Number Count-Up Animation
     * Detects when a stat value updates from '--' to a number and counts it up smoothly.
     */
    function initCountUpObserver() {
        const statValues = document.querySelectorAll('.stat-value, .stat-number, #stat-total, #stat-active, #stat-banned, #post-stat-total, #post-stat-public, #post-stat-friends, #post-stat-private, #mod-stat-total, #mod-stat-active, #mod-stat-locked, #report-stat-total, #report-stat-pending, #report-stat-resolved, #log-actions-today, #log-pending-posts, #log-banned-users, #stat-pending-count, #stat-banned-count, #stat-processed-today, #big-total-users, #big-total-posts, #big-banned, #big-moderators, #big-pending-reports');
        if (statValues.length === 0) return;

        statValues.forEach(el => {
            let lastText = el.textContent.trim();

            const observer = new MutationObserver(() => {
                const text = el.textContent.trim();
                if (text === lastText) return;
                lastText = text;

                // If text is a valid number, animate counting up
                if (text && text !== '--' && !isNaN(parseInt(text)) && !el.hasAttribute('data-counting')) {
                    el.setAttribute('data-counting', 'true');
                    const targetVal = parseInt(text);
                    const obj = { val: 0 };

                    gsap.fromTo(obj, 
                        { val: 0 },
                        {
                            val: targetVal,
                            duration: 1.2,
                            ease: 'power2.out',
                            onUpdate: () => {
                                el.textContent = Math.floor(obj.val);
                            },
                            onComplete: () => {
                                el.textContent = targetVal;
                                el.removeAttribute('data-counting');
                                lastText = targetVal.toString();
                            }
                        }
                    );
                }
            });

            observer.observe(el, { childList: true, characterData: true, subtree: true });
        });
    }

    /**
     * MutationObserver for dynamically loaded elements
     * Handles staggered entry for newly appended posts and table rows.
     */
    function initDynamicContentObserver() {
        // --- 1. User Post Feed Observer ---
        const feedContainer = document.querySelector('#posts-container') || document.querySelector('#profile-posts-container');
        if (feedContainer) {
            const feedObserver = new MutationObserver((mutations) => {
                const newCards = [];
                mutations.forEach(m => {
                    m.addedNodes.forEach(n => {
                        if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains('card') && !n.classList.contains('skeleton-post') && !n.hasAttribute('data-gsap-animated')) {
                            n.setAttribute('data-gsap-animated', 'true');
                            newCards.push(n);
                        }
                    });
                });

                if (newCards.length > 0) {
                    gsap.from(newCards, {
                        y: 35,
                        opacity: 0,
                        scale: 0.97,
                        duration: 0.5,
                        stagger: 0.08,
                        ease: 'power2.out',
                        clearProps: 'transform,opacity'
                    });
                }
            });
            feedObserver.observe(feedContainer, { childList: true });
        }

        // --- 2. Table Rows (Admin/Moderator) Observer ---
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const tableObserver = new MutationObserver((mutations) => {
                    const newRows = [];
                    mutations.forEach(m => {
                        m.addedNodes.forEach(n => {
                            if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'TR' && 
                                !n.classList.contains('loading-cell') && !n.classList.contains('table-loading') && 
                                !n.hasAttribute('data-gsap-animated')) {
                                n.setAttribute('data-gsap-animated', 'true');
                                newRows.push(n);
                            }
                        });
                    });

                    if (newRows.length > 0) {
                        gsap.from(newRows, {
                            opacity: 0,
                            y: 15,
                            duration: 0.4,
                            stagger: 0.04,
                            ease: 'power2.out',
                            clearProps: 'transform,opacity'
                        });
                    }
                });
                tableObserver.observe(tbody, { childList: true });
            }
        });
    }

    /**
     * Modals Reveal Animation
     * Triggers clean scale and fade reveals when modals are opened
     */
    function initModalObserver() {
        const modals = document.querySelectorAll('.modal-overlay');
        if (modals.length === 0) return;

        modals.forEach(modal => {
            let lastState = isPageHidden(modal);

            const observer = new MutationObserver(() => {
                const isHidden = isPageHidden(modal);
                if (lastState && !isHidden) {
                    // Modal opened! Animate the inner content modal card
                    const card = modal.querySelector('.modal-content, .modal, .modal-card');
                    if (card) {
                        gsap.fromTo(card,
                            { scale: 0.9, opacity: 0 },
                            {
                                scale: 1,
                                opacity: 1,
                                duration: 0.4,
                                ease: 'back.out(1.2)',
                                clearProps: 'transform,opacity'
                            }
                        );
                    }
                }
                lastState = isHidden;
            });

            observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
        });
    }
})();
