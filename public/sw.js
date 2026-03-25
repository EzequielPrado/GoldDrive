self.addEventListener('push', function(event) {
    if (event.data) {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: '/app-logo.png',
        badge: '/app-logo.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: '2'
        },
        actions: [
          {action: 'explore', title: 'Abrir Aplicativo', icon: '/app-logo.png'},
          {action: 'close', title: 'Fechar', icon: '/app-logo.png'},
        ]
      };
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action !== 'close') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
                if (clientList.length > 0) {
                    let client = clientList[0];
                    for (let i = 0; i < clientList.length; i++) {
                        if (clientList[i].focused) {
                            client = clientList[i];
                        }
                    }
                    return client.focus();
                }
                return clients.openWindow('/');
            })
        );
    }
});