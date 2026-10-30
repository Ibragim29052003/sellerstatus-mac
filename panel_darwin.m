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
static NSTimeInterval duration(BOOL opening) {
    return NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion ? 0.0 : (opening ? 0.36 : 0.24);
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
static CGPathRef revealPath(NSRect bounds, CGFloat visibleHeight) {
    CGFloat left = NSMinX(bounds), right = NSMaxX(bounds), top = NSMaxY(bounds);
    CGFloat height = MAX(0, MIN(visibleHeight, NSHeight(bounds)));
    CGFloat bottom = top - height;
    CGFloat radius = MIN(16.0, height / 2.0);
    CGFloat curve = radius * 0.55228475;
    CGMutablePathRef path = CGPathCreateMutable();
    CGPathMoveToPoint(path, NULL, left, top);
    CGPathAddLineToPoint(path, NULL, right, top);
    CGPathAddLineToPoint(path, NULL, right, bottom + radius);
    CGPathAddCurveToPoint(path, NULL, right, bottom + radius - curve, right - radius + curve, bottom, right - radius, bottom);
    CGPathAddLineToPoint(path, NULL, left + radius, bottom);
    CGPathAddCurveToPoint(path, NULL, left + radius - curve, bottom, left, bottom + radius - curve, left, bottom + radius);
    CGPathAddLineToPoint(path, NULL, left, top);
    CGPathCloseSubpath(path);
    return path;
}
static void resetReveal(NSWindow *window) {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [window.contentView.layer.mask removeAnimationForKey:@"sellerstatus.reveal"];
    window.contentView.layer.mask = nil;
    [CATransaction commit];
    window.ignoresMouseEvents = NO;
    window.hasShadow = YES;
}
static void revealPanel(NSWindow *window, BOOL opening, NSUInteger generation) {
    NSView *root = window.contentView;
    NSTimeInterval interval = duration(opening);
    if (interval == 0) {
        if (!opening) [window orderOut:nil];
        resetReveal(window);
        objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        return;
    }
    CAShapeLayer *mask = (CAShapeLayer *)root.layer.mask;
    CGPathRef current = ((CAShapeLayer *)mask.presentationLayer).path;
    if (current == NULL) current = mask.path;
    CGPathRef from = current != NULL ? CGPathCreateCopy(current) : revealPath(root.bounds, opening ? 0 : NSHeight(root.bounds));
    CGPathRef to = revealPath(root.bounds, opening ? NSHeight(root.bounds) : 0);
    if (mask == nil) mask = [CAShapeLayer layer];

    // Clip a fixed-size viewport instead of resizing WKWebView or moving a whole
    // window across adjacent displays. On interruption continue from the current
    // presentation path, so rapid open/close never jumps back to an endpoint.
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    mask.frame = root.bounds;
    mask.fillColor = NSColor.blackColor.CGColor;
    mask.path = from;
    root.layer.mask = mask;
    [mask removeAnimationForKey:@"sellerstatus.reveal"];
    [CATransaction commit];
    window.ignoresMouseEvents = YES;
    window.hasShadow = NO;

    CABasicAnimation *animation = [CABasicAnimation animationWithKeyPath:@"path"];
    animation.fromValue = (id)from;
    animation.toValue = (id)to;
    animation.duration = interval;
    animation.timingFunction = opening
        ? [CAMediaTimingFunction functionWithControlPoints:0.22 :0.85 :0.28 :1.0]
        : [CAMediaTimingFunction functionWithControlPoints:0.4 :0.0 :0.8 :0.4];
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [CATransaction setCompletionBlock:^{
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!isCurrent(window, generation)) return;
            if (!opening) [window orderOut:nil];
            resetReveal(window);
            objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        });
    }];
    mask.path = to;
    [mask addAnimation:animation forKey:@"sellerstatus.reveal"];
    [CATransaction commit];
    CGPathRelease(from);
    CGPathRelease(to);
}
void ssShowPanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil) return;
    if (window.visible && ![objc_getAssociatedObject(window, &closingKey) boolValue] && objc_getAssociatedObject(window, &layoutKey) != nil) {
        [NSApp activateIgnoringOtherApps:YES];
        [window makeKeyAndOrderFront:nil];
        return;
    }
    observeDismissal(window);
    NSUInteger generation = nextGeneration(window);
    objc_setAssociatedObject(window, &closingKey, @NO, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    SSPanelLayout layout;
    NSRect target = panelFrame(&layout);
    objc_setAssociatedObject(window, &layoutKey, @{ @"cutoutWidth": @(layout.cutoutWidth), @"headerHeight": @(layout.headerHeight) }, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    window.animationBehavior = NSWindowAnimationBehaviorNone;
    [window setFrame:target display:NO];
    layoutPanel(window);
    window.alphaValue = 1.0;
    // Install the collapsed mask before exposing a hidden window, avoiding a
    // single full-frame flash before the first Core Animation transaction.
    if (!window.visible && duration(YES) > 0) {
        CAShapeLayer *mask = [CAShapeLayer layer];
        mask.frame = window.contentView.bounds;
        CGPathRef path = revealPath(window.contentView.bounds, 0);
        mask.path = path;
        CGPathRelease(path);
        window.contentView.layer.mask = mask;
        window.hasShadow = NO;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [window makeKeyAndOrderFront:nil];
    revealPanel(window, YES, generation);
}
void ssHidePanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil || !window.visible || [objc_getAssociatedObject(window, &closingKey) boolValue]) return;
    NSUInteger generation = nextGeneration(window);
    objc_setAssociatedObject(window, &closingKey, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    revealPanel(window, NO, generation);
}
void ssTogglePanel(void *handle) {
    NSWindow *window = (NSWindow *)handle;
    if (window == nil) return;
    if (!window.visible || [objc_getAssociatedObject(window, &closingKey) boolValue]) ssShowPanel(handle);
    else ssHidePanel(handle);
}
