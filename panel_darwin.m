#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>

// Public AppKit APIs only. Every entry point is called on the main thread.
static char generationKey;
static char closingKey;
static char observersKey;
void ssHidePanel(void *handle);
static void observeDismissal(NSWindow *window) {
    if (objc_getAssociatedObject(window, &observersKey) != nil) return;
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    id windowObserver = [center addObserverForName:NSWindowDidResignKeyNotification object:window queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
        ssHidePanel((void *)window);
    }];
    id appObserver = [center addObserverForName:NSApplicationDidResignActiveNotification object:NSApp queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
        ssHidePanel((void *)window);
    }];
    objc_setAssociatedObject(window, &observersKey, @[windowObserver, appObserver], OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
static NSUInteger nextGeneration(NSWindow *window) {
    NSUInteger generation = [objc_getAssociatedObject(window, &generationKey) unsignedIntegerValue] + 1;
    objc_setAssociatedObject(window, &generationKey, @(generation), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    return generation;
}
static BOOL isCurrent(NSWindow *window, NSUInteger generation) {
    return [objc_getAssociatedObject(window, &generationKey) unsignedIntegerValue] == generation;
}
static NSTimeInterval duration(void) {
    return NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion ? 0.0 : 0.20;
}
static NSRect panelFrame(NSWindow *window) {
    NSScreen *screen = NSScreen.mainScreen;
    NSPoint pointer = NSEvent.mouseLocation;
    for (NSScreen *candidate in NSScreen.screens) {
        if (NSMouseInRect(pointer, candidate.frame, NO)) { screen = candidate; break; }
    }
    NSRect available = screen.visibleFrame;
    CGFloat width = MIN(420.0, available.size.width - 32.0);
    CGFloat height = MIN(740.0, available.size.height - 32.0);
    // Keep all controls below the notch and menu bar, including external displays.
    CGFloat safeTop = MIN(NSMaxY(available), NSMaxY(screen.frame) - screen.safeAreaInsets.top);
    return NSMakeRect(NSMidX(available) - width / 2.0, safeTop - height - 8.0, width, height);
}
void ssShowPanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil) return;
    observeDismissal(window);
    nextGeneration(window);
    objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    NSRect target = panelFrame(window);
    NSRect start = NSInsetRect(target, 5.0, 7.0);
    start.origin.y += 22.0;
    window.animationBehavior = NSWindowAnimationBehaviorNone;
    [window setFrame:start display:NO];
    window.alphaValue = duration() > 0 ? 0.0 : 1.0;
    [NSApp activateIgnoringOtherApps:YES];
    [window makeKeyAndOrderFront:nil];
    [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
        context.duration = duration();
        context.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseOut];
        [[window animator] setFrame:target display:YES];
        [[window animator] setAlphaValue:1.0];
    } completionHandler:nil];
}
void ssHidePanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil || !window.visible || [objc_getAssociatedObject(window, &closingKey) boolValue]) return;
    NSUInteger generation = nextGeneration(window);
    objc_setAssociatedObject(window, &closingKey, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    NSRect target = NSInsetRect(window.frame, 4.0, 5.0);
    target.origin.y += 18.0;
    [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
        context.duration = duration();
        context.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseIn];
        [[window animator] setFrame:target display:YES];
        [[window animator] setAlphaValue:0.0];
    } completionHandler:^{
        // A quick reopen invalidates this callback, so it cannot hide a new panel.
        if (!isCurrent(window, generation)) return;
        [window orderOut:nil];
        window.alphaValue = 1.0;
        objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }];
}
void ssTogglePanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil) return;
    if (!window.visible || [objc_getAssociatedObject(window, &closingKey) boolValue]) ssShowPanel(handle);
    else ssHidePanel(handle);
}
