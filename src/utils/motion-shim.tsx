import React, { forwardRef } from 'react';

// Lightweight, 100% React 19-safe drop-in replacement for motion/react
export const AnimatePresence: React.FC<{ children?: React.ReactNode; mode?: 'wait' | 'sync' | 'popLayout' }> = ({ children }) => {
    return <>{children}</>;
};

// Filter out motion-specific props so React DOM doesn't warn or fail
const filterMotionProps = (props: Record<string, any>) => {
    const {
        initial,
        animate,
        exit,
        transition,
        variants,
        whileHover,
        whileTap,
        whileFocus,
        whileDrag,
        whileInView,
        layout,
        layoutId,
        onAnimationComplete,
        onAnimationStart,
        ...rest
    } = props;
    return rest;
};

const createMotionComponent = (tag: string) => {
    const Component = forwardRef<any, any>((props, ref) => {
        const cleanProps = filterMotionProps(props);
        return React.createElement(tag, { ref, ...cleanProps });
    });
    Component.displayName = `motion.${tag}`;
    return Component;
};

// Motion proxy supporting motion.div, motion.button, motion.h1, etc.
const motionTags = ['div', 'button', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'section', 'header', 'footer', 'nav', 'ul', 'li', 'a', 'table', 'tr', 'td', 'th'];
const cache: Record<string, any> = {};

motionTags.forEach(tag => {
    cache[tag] = createMotionComponent(tag);
});

export const motion = new Proxy(cache, {
    get: (target, prop: string) => {
        if (!target[prop]) {
            target[prop] = createMotionComponent(prop);
        }
        return target[prop];
    }
}) as any;

// Safe mock hooks for any components requesting scroll or springs
export const useScroll = (_options?: any) => {
    return {
        scrollY: { get: () => 0, onChange: () => () => {} },
        scrollX: { get: () => 0, onChange: () => () => {} },
        scrollYProgress: { get: () => 0, onChange: () => () => {} },
        scrollXProgress: { get: () => 0, onChange: () => () => {} },
    };
};

export const useSpring = (val: any) => val;
export const useTransform = (_value: any, _input: any, output: any) => output?.[0] ?? 0;
export const useMotionValue = (initial: any) => ({ get: () => initial, set: () => {} });

export default motion;
