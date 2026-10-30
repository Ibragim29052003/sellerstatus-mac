#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

// Public AppKit APIs only. Every entry point is called on the main thread.
static char generationKey;
static char closingKey;
static char observersKey;
static char layoutKey;
typedef struct { double cutoutWidth; double headerHeight; } SSPanelLayout;
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
static NSRect panelFrame(SSPanelLayout *layout) {
    NSScreen *screen = NSScreen.mainScreen;
    NSPoint pointer = NSEvent.mouseLocation;
    for (NSScreen *candidate in NSScreen.screens) {
        if (NSMouseInRect(pointer, candidate.frame, NO)) { screen = candidate; break; }
    }
    NSRect available = screen.visibleFrame;
    NSRect left = screen.auxiliaryTopLeftArea;
    NSRect right = screen.auxiliaryTopRightArea;
    BOOL hasCutout = screen.safeAreaInsets.top > 0;
    BOOL hasCutoutBounds = hasCutout && !NSIsEmptyRect(left) && !NSIsEmptyRect(right) && NSMinX(right) > NSMaxX(left);
    layout->cutoutWidth = hasCutout ? (hasCutoutBounds ? NSMinX(right) - NSMaxX(left) : 200.0) : 0;
    layout->headerHeight = MAX(36.0, screen.safeAreaInsets.top);
    CGFloat centre = hasCutoutBounds ? (NSMaxX(left) + NSMinX(right)) / 2.0 : NSMidX(screen.frame);
    CGFloat width = MIN(hasCutout ? MAX(520.0, layout->cutoutWidth + 288.0) : 420.0, available.size.width - 32.0);
    CGFloat height = MIN(740.0, NSMaxY(screen.frame) - NSMinY(available) - 16.0);
    // Overscan one physical pixel. This also covers fractional backing-store
    // rounding at the display edge; no CSS border or native strip is needed.
    CGFloat overscan = 1.0 / MAX(1.0, screen.backingScaleFactor);
    return NSMakeRect(round(centre - width / 2.0), NSMaxY(screen.frame) - height, width, height + overscan);
}
SSPanelLayout ssGetPanelLayout(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    NSDictionary *saved = objc_getAssociatedObject(window, &layoutKey);
    if (saved != nil) return (SSPanelLayout){ [saved[@"cutoutWidth"] doubleValue], [saved[@"headerHeight"] doubleValue] };
    SSPanelLayout layout;
    panelFrame(&layout);
    return layout;
}
static void layoutPanel(NSWindow *window) {
    NSView *root = window.contentView;
    window.level = NSStatusWindowLevel;
    window.opaque = NO;
    window.backgroundColor = NSColor.clearColor;
    root.wantsLayer = YES;
    root.layer.backgroundColor = NSColor.clearColor.CGColor;
    root.layer.cornerRadius = 16.0;
    root.layer.maskedCorners = kCALayerMinXMinYCorner | kCALayerMaxXMinYCorner;
    root.layer.masksToBounds = YES;
    WKWebView *webView = findWebView(root);
    webView.frame = root.bounds;
    webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
}
void ssShowPanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil) return;
    observeDismissal(window);
    NSUInteger generation = nextGeneration(window);
    objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    SSPanelLayout layout;
    NSRect target = panelFrame(&layout);
    objc_setAssociatedObject(window, &layoutKey, @{ @"cutoutWidth": @(layout.cutoutWidth), @"headerHeight": @(layout.headerHeight) }, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    // Keep the web viewport constant for the whole animation: changing its size
    // can wrap text and momentarily create a document scrollbar.
    NSRect start = target;
    start.origin.y += 22.0;
    window.animationBehavior = NSWindowAnimationBehaviorNone;
    [window setFrame:start display:NO];
    layoutPanel(window);
    window.alphaValue = duration() > 0 ? 0.0 : 1.0;
    [NSApp activateIgnoringOtherApps:YES];
    [window makeKeyAndOrderFront:nil];
    [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
        context.duration = duration();
        context.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseOut];
        [[window animator] setFrame:target display:YES];
        [[window animator] setAlphaValue:1.0];
    } completionHandler:^{
        if (isCurrent(window, generation)) [window setFrame:target display:YES];
    }];
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
