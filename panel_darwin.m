#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>
#import <WebKit/WebKit.h>
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
static WKWebView *findWebView(NSView *view) {
    if ([view isKindOfClass:WKWebView.class]) return (WKWebView *)view;
    for (NSView *child in view.subviews) {
        WKWebView *found = findWebView(child);
        if (found != nil) return found;
    }
    return nil;
}
static NSRect panelFrame(CGFloat *topInset) {
    NSScreen *screen = NSScreen.mainScreen;
    NSPoint pointer = NSEvent.mouseLocation;
    for (NSScreen *candidate in NSScreen.screens) {
        if (NSMouseInRect(pointer, candidate.frame, NO)) { screen = candidate; break; }
    }
    NSRect available = screen.visibleFrame;
    CGFloat width = MIN(420.0, available.size.width - 32.0);
    // The background reaches the physical edge; interactive content stays below
    // the camera housing/menu bar. A display without a notch uses its menu height.
    *topInset = MAX(screen.safeAreaInsets.top, NSMaxY(screen.frame) - NSMaxY(available));
    CGFloat height = MIN(740.0 + *topInset, NSMaxY(screen.frame) - NSMinY(available) - 16.0);
    return NSMakeRect(NSMidX(screen.frame) - width / 2.0, NSMaxY(screen.frame) - height, width, height);
}
static void layoutPanel(NSWindow *window, CGFloat topInset) {
    NSView *root = window.contentView;
    window.level = NSStatusWindowLevel;
    window.opaque = NO;
    window.backgroundColor = NSColor.clearColor;
    root.wantsLayer = YES;
    root.layer.backgroundColor = NSColor.blackColor.CGColor;
    root.layer.cornerRadius = 16.0;
    root.layer.maskedCorners = kCALayerMinXMinYCorner | kCALayerMaxXMinYCorner;
    root.layer.masksToBounds = YES;
    WKWebView *webView = findWebView(root);
    webView.frame = NSMakeRect(0, 0, NSWidth(root.bounds), MAX(1, NSHeight(root.bounds) - topInset));
    webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
}
void ssShowPanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil) return;
    observeDismissal(window);
    nextGeneration(window);
    objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    CGFloat topInset = 0;
    NSRect target = panelFrame(&topInset);
    // Keep the web viewport constant for the whole animation: changing its size
    // can wrap text and momentarily create a document scrollbar.
    NSRect start = target;
    start.origin.y += 22.0;
    window.animationBehavior = NSWindowAnimationBehaviorNone;
    [window setFrame:start display:NO];
    layoutPanel(window, topInset);
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
    NSRect target = window.frame;
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
