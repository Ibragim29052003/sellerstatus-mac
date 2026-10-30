#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

extern void plannerGoSummary(void);
extern void plannerGoReload(void);

@interface SSPlannerHost : NSObject <NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate>
@property(strong) NSWindow *window;
@property(strong) WKWebView *web;
@property(copy) NSString *origin;
@property(copy) NSString *secret;
@property(copy) NSString *theme;
@property(copy) NSString *styles;
@property(strong) NSButton *backButton;
@property(strong) NSTextField *status;
@property(strong) NSMutableSet<WKDownload *> *downloads;
- (void)open:(NSString *)origin secret:(NSString *)secret theme:(NSString *)theme;
@end

@implementation SSPlannerHost
- (BOOL)ownsURL:(NSURL *)url {
    NSURL *base = [NSURL URLWithString:self.origin];
    return [url.scheme isEqual:base.scheme] && [url.host isEqual:base.host] && [url.port isEqual:base.port] && !url.user && !url.password;
}
- (NSString *)themeScript {
    NSString *value = [self.theme isEqual:@"dark"] ? @"'dark'" : [self.theme isEqual:@"light"] ? @"'light'" : @"null";
    return [NSString stringWithFormat:@"(()=>{const k='sellerstatus.supply-planner.theme',v=%@;try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k)}catch{};document.documentElement.dataset.theme=v||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:v}));})();",value];
}
- (void)applyTheme {
    if (!self.web) return;
    self.window.appearance = [self.theme isEqual:@"dark"] ? [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua] : [self.theme isEqual:@"light"] ? [NSAppearance appearanceNamed:NSAppearanceNameAqua] : nil;
    WKUserContentController *controller = self.web.configuration.userContentController;
    [controller removeAllUserScripts];
    [controller addUserScript:[[WKUserScript alloc] initWithSource:[self themeScript] injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
    NSData *encoded = [NSJSONSerialization dataWithJSONObject:@[self.styles ?: @""] options:0 error:nil];
    NSString *css = [[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding];
    NSString *style = [NSString stringWithFormat:@"(()=>{let s=document.getElementById('sellerstatus-desktop-style');if(!s){s=document.createElement('style');s.id='sellerstatus-desktop-style';document.head.append(s)}s.textContent=(%@)[0];if(!window.sellerstatusDesktopStyle){window.sellerstatusDesktopStyle=true;document.addEventListener('keydown',e=>{if(e.key==='Tab')document.documentElement.setAttribute('data-desktop-keyboard','')});document.addEventListener('pointerdown',()=>document.documentElement.removeAttribute('data-desktop-keyboard'))}})();",css];
    [controller addUserScript:[[WKUserScript alloc] initWithSource:style injectionTime:WKUserScriptInjectionTimeAtDocumentEnd forMainFrameOnly:YES]];
    [self.web evaluateJavaScript:[self themeScript] completionHandler:nil];
    if (self.web.URL) [self.web evaluateJavaScript:style completionHandler:nil];
}
- (void)createWindow {
    self.downloads = [NSMutableSet set];
    NSRect available = NSScreen.mainScreen.visibleFrame;
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0,0,MIN(1440,available.size.width-64),MIN(920,available.size.height-64)) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskMiniaturizable|NSWindowStyleMaskResizable backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"SellerStatus — планировщик поставок";
    self.window.minSize = NSMakeSize(960,650);
    self.window.releasedWhenClosed = NO;
    self.window.delegate = self;
    [self.window center];
    NSView *content = self.window.contentView;
    NSButton *summary = [NSButton buttonWithTitle:@"Сводка" target:self action:@selector(summary:)];
    summary.image = [NSImage imageWithSystemSymbolName:@"menubar.rectangle" accessibilityDescription:nil];
    summary.imagePosition = NSImageLeft;
    NSButton *back = [NSButton buttonWithTitle:@"Назад" target:self action:@selector(back:)];
    self.backButton = back; back.enabled = NO;
    NSButton *reload = [NSButton buttonWithTitle:@"Обновить" target:self action:@selector(reload:)];
    self.status = [NSTextField labelWithString:@"Локальные сценарии"];
    self.status.textColor = NSColor.secondaryLabelColor;
    self.status.font = [NSFont systemFontOfSize:12];
    NSStackView *bar = [NSStackView stackViewWithViews:@[summary,back,reload,self.status]];
    bar.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    bar.spacing = 12;
    bar.translatesAutoresizingMaskIntoConstraints = NO;
    [content addSubview:bar];
    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.websiteDataStore = [WKWebsiteDataStore nonPersistentDataStore];
    self.web = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.web.translatesAutoresizingMaskIntoConstraints = NO;
    self.web.navigationDelegate = self;
    self.web.UIDelegate = self;
    self.web.allowsBackForwardNavigationGestures = YES;
    [content addSubview:self.web];
    [NSLayoutConstraint activateConstraints:@[
        [bar.leadingAnchor constraintEqualToAnchor:content.leadingAnchor constant:16],
        [bar.topAnchor constraintEqualToAnchor:content.topAnchor constant:10],
        [bar.trailingAnchor constraintLessThanOrEqualToAnchor:content.trailingAnchor constant:-16],
        [self.web.topAnchor constraintEqualToAnchor:bar.bottomAnchor constant:10],
        [self.web.leadingAnchor constraintEqualToAnchor:content.leadingAnchor],
        [self.web.trailingAnchor constraintEqualToAnchor:content.trailingAnchor],
        [self.web.bottomAnchor constraintEqualToAnchor:content.bottomAnchor]
    ]];
}
- (void)loadHome {
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[self.origin stringByAppendingString:@"/"]]];
    [request setValue:self.secret forHTTPHeaderField:@"X-SellerStatus-Desktop"];
    [self.web loadRequest:request];
}
- (void)open:(NSString *)origin secret:(NSString *)secret theme:(NSString *)theme {
    BOOL changed = ![self.origin isEqual:origin] || ![self.secret isEqual:secret];
    self.origin = origin; self.secret = secret; self.theme = theme;
    if (!self.window) [self createWindow];
    [self applyTheme];
    if (changed || !self.web.URL) [self loadHome];
    [NSApp activateIgnoringOtherApps:YES];
    [self.window makeKeyAndOrderFront:nil];
}
- (BOOL)windowShouldClose:(NSWindow *)sender { [sender orderOut:nil]; return NO; }
- (void)summary:(id)sender { [self.window orderOut:nil]; plannerGoSummary(); }
- (void)back:(id)sender { if (self.web.canGoBack) [self.web goBack]; }
- (void)reload:(id)sender {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"Обновить планировщик?";
    alert.informativeText = @"Сохранённые расчёты останутся. Изменения, которые вы ещё не рассчитали или не сохранили, будут потеряны.";
    [alert addButtonWithTitle:@"Обновить"]; [alert addButtonWithTitle:@"Отмена"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
        if (response == NSAlertFirstButtonReturn) { self.status.stringValue = @"Открываем планировщик…"; plannerGoReload(); }
    }];
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    decisionHandler([self ownsURL:action.request.URL] ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)response decisionHandler:(void (^)(WKNavigationResponsePolicy))decisionHandler {
    if (![self ownsURL:response.response.URL]) { decisionHandler(WKNavigationResponsePolicyCancel); return; }
    NSString *disposition = [(NSHTTPURLResponse *)response.response valueForHTTPHeaderField:@"Content-Disposition"];
    decisionHandler(!response.canShowMIMEType || [[disposition lowercaseString] containsString:@"attachment"] ? WKNavigationResponsePolicyDownload : WKNavigationResponsePolicyAllow);
}
- (void)webView:(WKWebView *)webView navigationResponse:(WKNavigationResponse *)response didBecomeDownload:(WKDownload *)download { [self.downloads addObject:download]; download.delegate = self; }
- (void)webView:(WKWebView *)webView navigationAction:(WKNavigationAction *)action didBecomeDownload:(WKDownload *)download { [self.downloads addObject:download]; download.delegate = self; }
- (void)download:(WKDownload *)download decideDestinationUsingResponse:(NSURLResponse *)response suggestedFilename:(NSString *)suggestedFilename completionHandler:(void (^)(NSURL *))completionHandler {
    NSSavePanel *panel = [NSSavePanel savePanel];
    panel.nameFieldStringValue = suggestedFilename.lastPathComponent;
    panel.extensionHidden = NO;
    panel.directoryURL = [[NSFileManager defaultManager] URLsForDirectory:NSDownloadsDirectory inDomains:NSUserDomainMask].firstObject;
    panel.canCreateDirectories = YES;
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        completionHandler(result == NSModalResponseOK ? panel.URL : nil);
    }];
}
- (void)download:(WKDownload *)download willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request decisionHandler:(void (^)(WKDownloadRedirectPolicy))decisionHandler {
    decisionHandler([self ownsURL:request.URL] ? WKDownloadRedirectPolicyAllow : WKDownloadRedirectPolicyCancel);
}
- (void)downloadDidFinish:(WKDownload *)download { [self.downloads removeObject:download]; self.status.stringValue = @"Файл сохранён"; }
- (void)download:(WKDownload *)download didFailWithError:(NSError *)error resumeData:(NSData *)resumeData { [self.downloads removeObject:download]; self.status.stringValue = error.code == NSURLErrorCancelled ? @"Сохранение отменено" : @"Не удалось сохранить файл. Повторите экспорт."; }
- (void)webView:(WKWebView *)webView runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSArray<NSURL *> *))completionHandler {
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseDirectories = NO; panel.canChooseFiles = YES; panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) { completionHandler(result == NSModalResponseOK ? panel.URLs : nil); }];
}
- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init]; alert.messageText = message; [alert addButtonWithTitle:@"Продолжить"]; [alert addButtonWithTitle:@"Отмена"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) { completionHandler(result == NSAlertFirstButtonReturn); }];
}
- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init]; alert.messageText = message; [alert addButtonWithTitle:@"OK"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) { completionHandler(); }];
}
- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation { self.status.stringValue = @"Локальные сценарии"; self.backButton.enabled = webView.canGoBack; }
- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error { if(error.code != NSURLErrorCancelled) self.status.stringValue = @"Не удалось открыть страницу. Нажмите «Обновить»."; }
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)webView { self.status.stringValue = @"Окно было выгружено. Нажмите «Обновить»."; }
@end

static SSPlannerHost *ssPlanner;
void ssOpenPlanner(const char *url, const char *secret, const char *theme, const char *styles) {
    if (!ssPlanner) ssPlanner = [SSPlannerHost new];
    ssPlanner.styles = [NSString stringWithUTF8String:styles];
    [ssPlanner open:[NSString stringWithUTF8String:url] secret:[NSString stringWithUTF8String:secret] theme:[NSString stringWithUTF8String:theme]];
}
void ssHidePlanner(void) { [ssPlanner.window orderOut:nil]; }
void ssPlannerTheme(const char *theme) { ssPlanner.theme = [NSString stringWithUTF8String:theme]; [ssPlanner applyTheme]; }
void ssReloadPlanner(void) { [ssPlanner loadHome]; }
void ssPlannerError(const char *message) {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"Планировщик недоступен";
    alert.informativeText = [NSString stringWithUTF8String:message];
    [alert addButtonWithTitle:@"OK"];
    [NSApp activateIgnoringOtherApps:YES];
    [alert runModal];
}
