#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <wayland-client.h>
#include "ext-idle-notify-v1-client-protocol.h"

static struct wl_seat *seat;
static struct ext_idle_notifier_v1 *notifier;
static void global(void *data, struct wl_registry *registry, uint32_t name,
                   const char *interface, uint32_t version) {
    (void)data; (void)version;
    if (!strcmp(interface, "wl_seat") && !seat)
        seat = wl_registry_bind(registry, name, &wl_seat_interface, 1);
    if (!strcmp(interface, "ext_idle_notifier_v1"))
        notifier = wl_registry_bind(registry, name, &ext_idle_notifier_v1_interface, 1);
}
static void removed(void *data, struct wl_registry *registry, uint32_t name) {
    (void)data; (void)registry; (void)name;
}
static const struct wl_registry_listener registry_listener = { global, removed };
static void idle(void *data, struct ext_idle_notification_v1 *notification) {
    (void)data; (void)notification; puts("IDLE"); fflush(stdout);
}
static void resumed(void *data, struct ext_idle_notification_v1 *notification) {
    (void)data; (void)notification; puts("ACTIVE"); fflush(stdout);
}
static const struct ext_idle_notification_v1_listener listener = { idle, resumed };
int main(void) {
    struct wl_display *display = wl_display_connect(NULL);
    if (!display) return 1;
    struct wl_registry *registry = wl_display_get_registry(display);
    wl_registry_add_listener(registry, &registry_listener, NULL);
    if (wl_display_roundtrip(display) < 0 || !seat || !notifier) {
        wl_display_disconnect(display); return 1;
    }
    struct ext_idle_notification_v1 *notification =
        ext_idle_notifier_v1_get_idle_notification(notifier, 60000, seat);
    ext_idle_notification_v1_add_listener(notification, &listener, NULL);
    puts("ACTIVE"); fflush(stdout);
    while (wl_display_dispatch(display) >= 0) {}
    wl_display_disconnect(display);
    return 1;
}
