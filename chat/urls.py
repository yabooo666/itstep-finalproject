from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat'),
    path('api/room/<int:room_id>/messages/', views.get_messages_api, name='chat_get_messages'),
    path('api/room/<int:room_id>/send/', views.send_message_api, name='chat_send_message'),
]
