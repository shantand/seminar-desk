'use client';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

type Step = {
    target: string;
    title: string;
    body: string;
};

const STEPS: Step[] = [
    { target: '[data-tour="tab-today"]', title: 'Welcome to Seminar Desk', body: 'Home gives you a quick snapshot of what needs attention today — follow-ups due, recent registrations. Let’s take a 30-second look around.' },
    { target: '[data-tour="tab-webinars"]', title: 'Webinars', body: 'Create and manage every webinar here — schedule, description, join link, and registration status all live in one place.' },
    { target: '[data-tour="create-webinar"]', title: 'Create a webinar', body: 'Start here. Once a webinar exists, each one gets buttons to invite people on WhatsApp, download a shareable flyer, duplicate it, or delete it.' },
    { target: '[data-tour="tab-people"]', title: 'Registrations', body: 'Everyone who registers lands here. Track follow-up status, call or message them, and see their full history.' },
    { target: '[data-tour="profile"]', title: 'Your workspace', body: 'Install the app to your home screen or sign out from here. That’s the tour — you’re ready to go.' },
];

const STORAGE_KEY = 'seminar-desk-tour-v1';

export function useOnboardingTour() {
    const [active, setActive] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY))
                setActive(true);
        }
    catch {
            // Browser storage unavailable — just skip the auto-start; the
            // tour can still be launched manually from the account menu.
        }
    }, []);

    const finish = useCallback(() => {
        setActive(false);
        setStep(0);
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        }
    catch {
            // Nothing to persist locally; the tour will just offer to
            // start again next time this loads.
        }
    }, []);

    const start = useCallback(() => {
        setStep(0);
        setActive(true);
    }, []);

    return { active, step, setStep, finish, start };
}

export function OnboardingTour({ active, step, setStep, finish }: {
    active: boolean;
    step: number;
    setStep: (n: number) => void;
    finish: () => void;
}) {
    const [rect, setRect] = useState<DOMRect | null>(null);
    const current = STEPS[step];

    useLayoutEffect(() => {
        if (!active || !current)
            return;
        function measure() {
            const el = current ? document.querySelector(current.target) : null;
            setRect(el ? el.getBoundingClientRect() : null);
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        measure();
        const id = window.setTimeout(measure, 260); // after any scroll settles
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.clearTimeout(id);
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [active, step, current]);

    if (!active || !current)
        return null;

    const pad = 8;
    const cardWidth = 320;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0;
    const cardTop = rect ? Math.min(rect.bottom + 16, viewportH - 220) : viewportH / 2 - 100;
    const cardLeft = rect ? Math.min(Math.max(rect.left, 16), viewportW - cardWidth - 16) : viewportW / 2 - cardWidth / 2;
    const last = step === STEPS.length - 1;

    return <div className="tour-overlay" role="dialog" aria-live="polite" aria-label={current.title}>
        {rect && <div className="tour-highlight" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}/>}
        <div className="tour-card" style={{ top: Math.max(16, cardTop), left: Math.max(16, cardLeft), width: cardWidth }}>
            <p className="tour-step-count">{step + 1} of {STEPS.length}</p>
            <h3>{current.title}</h3>
            <p>{current.body}</p>
            <div className="tour-actions">
                <button type="button" className="tour-skip" onClick={finish}>Skip tour</button>
                <div className="tour-nav">
                    {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Back</button>}
                    <button type="button" className="tour-next" onClick={() => (last ? finish() : setStep(step + 1))}>{last ? 'Done' : 'Next'}</button>
                </div>
            </div>
        </div>
    </div>;
}
